import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { storage } from "./storage";
import { autoCodeClaim, calculateRiskScore } from "./ai";
import { insertUserSchema, insertProviderSchema, insertBankSchema, insertClaimSchema, insertTeamMemberSchema, type User, dateRangeSchema, type DateRange } from "@shared/schema";
import { z } from "zod";
import { EHRSyncService } from "./ehr-sync";
import { testEHRConnection } from "./ehr";
import { ehrEmulator } from "./ehr-emulator";
import { sanitizeClaims, sanitizeClaim } from "./phi-anonymization";
import { seedRBAC } from "./seed-rbac";
import { sendInvitationEmail, sendApprovalRequestEmail, sendAccountApprovedEmail, sendAccountRejectedEmail } from "./sendgrid";
import { logRoleAssigned, logBulkOperation, logUserUpdated } from "./audit-logger";
import crypto from "crypto";

// Initialize Stripe (javascript_stripe integration)
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

// Passport configuration
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      console.log('[AUTH] Login attempt for username:', username);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log('[AUTH] User not found:', username);
        return done(null, false, { message: "Invalid credentials" });
      }

      console.log('[AUTH] User found:', { id: user.id, username: user.username, status: user.status });

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        console.log('[AUTH] Invalid password for user:', username);
        return done(null, false, { message: "Invalid credentials" });
      }

      // Check if user status is approved (for admin/bank users)
      if (user.status !== 'approved') {
        console.log('[AUTH] User status not approved:', user.status);
        if (user.status === 'pending') {
          return done(null, false, { message: "Account pending approval" });
        } else if (user.status === 'rejected') {
          return done(null, false, { message: "Account access denied" });
        }
      }

      console.log('[AUTH] Login successful for:', username);
      return done(null, user);
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      return done(error);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "claimpay-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  const requireRole = (role: string) => (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = req.user as User;
    const session = req.session as any;

    // Check if user is impersonating
    if (session.impersonating) {
      // If impersonating, check the impersonated role
      if (session.impersonatedRole === role) {
        return next();
      }
      // For admin routes, also allow super_admin impersonating as admin
      if (role === "admin" && session.impersonatedRole === "super_admin") {
        return next();
      }
      return res.status(403).json({ message: "Forbidden" });
    }

    // Not impersonating - check user's actual role
    // For admin routes, allow both admin and super_admin
    if (role === "admin" && (user.role === "admin" || user.role === "super_admin")) {
      return next();
    }
    
    // For other roles, require exact match
    if (user.role === role) {
      return next();
    }

    res.status(403).json({ message: "Forbidden" });
  };

  // ========== Auth Routes ==========
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(data.password, 12);

      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      req.login(user, async (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        
        // Get permissions based on user's internal role or regular role
        const roleToCheck = user.internalRole || user.role;
        const permissions = await storage.getPermissionsByRole(roleToCheck);
        
        // Check if there's an active impersonation session
        const session = req.session as any;
        const impersonationData = session.impersonating ? {
          impersonating: true,
          impersonateId: session.impersonateId,
          impersonatedRole: session.impersonatedRole,
          entityName: session.entityName,
        } : {
          impersonating: false,
          impersonateId: null,
          impersonatedRole: null,
          entityName: null,
        };
        
        res.json({ 
          user: { ...user, password: undefined },
          permissions,
          ...impersonationData,
        });
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('[LOGIN] Authentication error:', err);
        return res.status(500).json({ message: "Internal server error" });
      }
      
      if (!user) {
        console.log('[LOGIN] Authentication failed:', info?.message || 'Unknown reason');
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.logIn(user, async (err) => {
        if (err) {
          console.error('[LOGIN] Session error:', err);
          return res.status(500).json({ message: "Failed to create session" });
        }

        let provider = null;
        if (user.role === "provider") {
          const fullProvider = await storage.getProviderByUserId(user.id);
          provider = redactProviderSecrets(fullProvider);
        }

        // Get permissions based on user's internal role or regular role
        const roleToCheck = user.internalRole || user.role;
        const permissions = await storage.getPermissionsByRole(roleToCheck);

        // Check if there's an active impersonation session
        const session = req.session as any;
        const impersonationData = session.impersonating ? {
          impersonating: true,
          impersonateId: session.impersonateId,
          impersonatedRole: session.impersonatedRole,
          entityName: session.entityName,
        } : {
          impersonating: false,
          impersonateId: null,
          impersonatedRole: null,
          entityName: null,
        };

        console.log('[LOGIN] Login successful for user:', user.username);
        res.json({ 
          user: { ...user, password: undefined },
          provider,
          permissions,
          ...impersonationData,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Helper function to redact sensitive provider fields
  const redactProviderSecrets = (provider: any) => {
    if (!provider) return null;
    return {
      ...provider,
      ehrClientSecret: undefined,
      bankAccountNumber: undefined,
      bankRoutingNumber: undefined,
    };
  };

  // Helper function to redact sensitive bank fields
  const redactBankSecrets = (bank: any) => {
    if (!bank) return null;
    return {
      ...bank,
      achRoutingNumber: undefined,
      achAccountNumber: undefined,
    };
  };

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = req.user as any;
    const session = req.session as any;
    let provider = null;
    let bank = null;

    // Check if user is impersonating
    if (session.impersonating && session.impersonateId) {
      // User is impersonating - return impersonated entity data
      if (session.impersonatedRole === "provider") {
        const fullProvider = await storage.getProvider(session.impersonateId);
        provider = redactProviderSecrets(fullProvider);
      } else if (session.impersonatedRole === "bank") {
        const fullBank = await storage.getBank(session.impersonateId);
        bank = redactBankSecrets(fullBank);
      }

      // Get permissions based on original internal role
      const permissions = await storage.getPermissionsByRole(session.originalRole);

      return res.json({
        user: { ...user, password: undefined },
        provider,
        bank,
        permissions,
        impersonating: true,
        impersonateId: session.impersonateId,
        impersonatedRole: session.impersonatedRole,
        entityName: session.entityName,
      });
    }

    // Normal user (not impersonating)
    if (user.role === "provider") {
      const fullProvider = await storage.getProviderByUserId(user.id);
      provider = redactProviderSecrets(fullProvider);
    } else if (user.role === "bank") {
      const fullBank = await storage.getBankByUserId(user.id);
      bank = redactBankSecrets(fullBank);
    }

    // Get permissions based on user's internal role or regular role
    const roleToCheck = user.internalRole || user.role;
    const permissions = await storage.getPermissionsByRole(roleToCheck);

    res.json({
      user: { ...user, password: undefined },
      provider,
      bank,
      permissions,
      impersonating: false,
    });
  });

  // ========== Portal Switching & Impersonation Routes ==========

  // Switch portal with optional impersonation (admin only)
  app.post("/api/switch-portal", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = req.session as any;
      const { targetPortal, impersonateId } = req.body;

      // Only admin/super_admin can switch portals
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can switch portals" });
      }

      // Validate target portal
      if (!['customer', 'bank', 'internal'].includes(targetPortal)) {
        return res.status(400).json({ message: "Invalid target portal" });
      }

      // If switching to internal, clear impersonation
      if (targetPortal === 'internal') {
        session.impersonating = false;
        session.impersonateId = null;
        session.impersonatedRole = null;
        session.entityName = null;
        session.originalRole = null;
        return res.json({ message: "Switched to internal portal", impersonating: false });
      }

      // Determine entity to impersonate
      let entityId = impersonateId;
      let entityName = '';

      if (!entityId) {
        // Auto-select most active entity
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (targetPortal === 'customer') {
          // Find most active provider by claim count
          const result = await storage.getMostActiveProvider(thirtyDaysAgo);
          if (!result) {
            return res.status(404).json({ message: "No active providers found" });
          }
          entityId = result.id;
          entityName = result.providerName || `${result.firstName} ${result.lastName}`;
        } else if (targetPortal === 'bank') {
          // Find most active bank by funding volume
          const result = await storage.getMostActiveBank(thirtyDaysAgo);
          if (!result) {
            return res.status(404).json({ message: "No active banks found" });
          }
          entityId = result.id;
          entityName = result.bankName;
        }
      } else {
        // Validate provided entity ID
        if (targetPortal === 'customer') {
          const provider = await storage.getProvider(entityId);
          if (!provider || !provider.isActive) {
            return res.status(404).json({ message: "Provider not found or inactive" });
          }
          entityName = provider.providerName || `${provider.firstName} ${provider.lastName}`;
        } else if (targetPortal === 'bank') {
          const bank = await storage.getBank(entityId);
          if (!bank || !bank.isActive) {
            return res.status(404).json({ message: "Bank not found or inactive" });
          }
          entityName = bank.bankName;
        }
      }

      // Set impersonation in session
      session.impersonating = true;
      session.impersonateId = entityId;
      session.impersonatedRole = targetPortal === 'customer' ? 'provider' : 'bank';
      session.entityName = entityName;
      session.originalRole = user.role;

      res.json({
        message: `Switched to ${targetPortal} portal`,
        impersonating: true,
        impersonateId: entityId,
        entityName,
      });
    } catch (error: any) {
      console.error("Portal switch error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Switch entity within current portal (admin only, must be impersonating)
  app.post("/api/switch-entity", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = req.session as any;
      const { targetId } = req.body;

      // Only admin/super_admin can switch entities
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can switch entities" });
      }

      // Must be impersonating
      if (!session.impersonating) {
        return res.status(400).json({ message: "Not currently impersonating" });
      }

      let entityName = '';

      // Validate target entity matches current portal type
      if (session.impersonatedRole === 'provider') {
        const provider = await storage.getProvider(targetId);
        if (!provider || !provider.isActive) {
          return res.status(404).json({ message: "Provider not found or inactive" });
        }
        entityName = provider.providerName || `${provider.firstName} ${provider.lastName}`;
      } else if (session.impersonatedRole === 'bank') {
        const bank = await storage.getBank(targetId);
        if (!bank || !bank.isActive) {
          return res.status(404).json({ message: "Bank not found or inactive" });
        }
        entityName = bank.bankName;
      }

      // Update session with new entity
      session.impersonateId = targetId;
      session.entityName = entityName;

      res.json({
        message: "Entity switched successfully",
        impersonateId: targetId,
        entityName,
      });
    } catch (error: any) {
      console.error("Entity switch error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get list of entities for selector (admin only)
  app.get("/api/entities", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { type, search } = req.query;

      // Only admin/super_admin can access entities list
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can access entities" });
      }

      if (!type || !['customer', 'bank'].includes(type as string)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let entities: any[] = [];

      if (type === 'customer') {
        entities = await storage.getProviderEntities(search as string, thirtyDaysAgo);
      } else if (type === 'bank') {
        entities = await storage.getBankEntities(search as string, thirtyDaysAgo);
      }

      res.json({ entities });
    } catch (error: any) {
      console.error("Get entities error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== Provider Routes ==========

  app.post("/api/providers", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const data = insertProviderSchema.parse({
        ...req.body,
        userId: user.id,
      });

      const provider = await storage.createProvider(data);
      
      // SECURITY: Never expose sensitive credentials
      res.json(redactProviderSecrets(provider));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/providers/:id", requireAuth, async (req, res) => {
    const provider = await storage.getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    
    // SECURITY: Never expose sensitive credentials
    res.json(redactProviderSecrets(provider));
  });

  // ========== Bank Routes ==========

  app.post("/api/banks", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== "bank") {
        return res.status(403).json({ message: "Only bank users can create bank profiles" });
      }

      const data = insertBankSchema.parse({
        ...req.body,
        userId: user.id,
      });

      const bank = await storage.createBank(data);
      
      // SECURITY: Never expose sensitive credentials
      res.json(redactBankSecrets(bank));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/banks/:id", requireAuth, async (req, res) => {
    const bank = await storage.getBank(req.params.id);
    if (!bank) {
      return res.status(404).json({ message: "Bank not found" });
    }
    
    // SECURITY: Never expose sensitive credentials
    res.json(redactBankSecrets(bank));
  });

  // ========== Settings Routes ==========

  app.put("/api/user", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const updateSchema = z.object({
        email: z.string().email().optional(),
        password: z.string().min(8).optional(),
      }).refine(data => data.email || data.password, {
        message: "At least one field (email or password) must be provided"
      });

      const data = updateSchema.parse(req.body);
      const updates: any = {};

      if (data.email && data.email !== user.email) {
        const existingUser = await storage.getUserByEmail(data.email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = data.email;
      }

      if (data.password) {
        updates.password = await bcrypt.hash(data.password, 12);
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ user: { ...user, password: undefined } });
      }

      const updatedUser = await storage.updateUser(user.id, updates);
      res.json({ user: { ...updatedUser, password: undefined } });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/provider/settings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile not found" });
      }

      const updateSchema = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional(),
        bankRoutingNumber: z.string().length(9).optional(),
        bankAccountNumber: z.string().min(4).optional(),
        ehrSystem: z.string().optional(),
        ehrApiEndpoint: z.union([z.literal(""), z.literal(null), z.string().url()]).optional().nullable(),
        ehrClientId: z.string().optional(),
        ehrClientSecret: z.string().optional(),
        ehrEnabled: z.boolean().optional(),
        notificationSettings: z.object({
          emailNotifications: z.boolean().optional(),
          claimStatusUpdates: z.boolean().optional(),
          paymentConfirmations: z.boolean().optional(),
          weeklyReports: z.boolean().optional(),
        }).optional(),
        instantPaymentThreshold: z.object({
          interval: z.string().optional(),
          claimLimitType: z.string().optional(),
          claimLimitValue: z.number().optional(),
        }).optional(),
      });

      const data = updateSchema.parse(req.body);
      const updatedProvider = await storage.updateProvider(provider.id, data);
      
      res.json(redactProviderSecrets(updatedProvider));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== Team Members Routes ==========

  app.get("/api/team-members", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = req.session as any;
      
      let provider;
      
      // Check if impersonating
      if (session.impersonating && session.impersonatedRole === 'provider') {
        provider = await storage.getProvider(session.impersonateId);
      } else {
        provider = await storage.getProviderByUserId(user.id);
      }
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile not found" });
      }

      const teamMembers = await storage.getTeamMembersByProviderId(provider.id);
      
      const membersWithUsers = await Promise.all(
        teamMembers.map(async (member) => {
          const memberUser = await storage.getUser(member.userId);
          return {
            ...member,
            user: memberUser ? { ...memberUser, password: undefined } : null,
          };
        })
      );
      
      res.json(membersWithUsers);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/team-members", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile not found" });
      }

      const createSchema = z.object({
        email: z.string().email().optional(),
        userId: z.string().optional(),
        role: z.enum(["admin", "member"]).default("member"),
      });

      const data = createSchema.parse(req.body);
      
      let targetUserId = data.userId;
      
      if (!targetUserId && data.email) {
        const existingUser = await storage.getUserByEmail(data.email);
        if (!existingUser) {
          return res.status(404).json({ message: "User not found with that email" });
        }
        targetUserId = existingUser.id;
      }
      
      if (!targetUserId) {
        return res.status(400).json({ message: "Either userId or email is required" });
      }

      const teamMember = await storage.createTeamMember({
        providerId: provider.id,
        userId: targetUserId,
        role: data.role,
      });
      
      const memberUser = await storage.getUser(teamMember.userId);
      
      res.json({
        ...teamMember,
        user: memberUser ? { ...memberUser, password: undefined } : null,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/team-members/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile not found" });
      }

      const teamMember = await storage.getTeamMember(req.params.id);
      if (!teamMember || teamMember.providerId !== provider.id) {
        return res.status(404).json({ message: "Team member not found" });
      }

      const updateSchema = z.object({
        role: z.enum(["admin", "member"]),
      });

      const data = updateSchema.parse(req.body);
      const updatedMember = await storage.updateTeamMember(req.params.id, { role: data.role });
      
      if (!updatedMember) {
        return res.status(404).json({ message: "Failed to update team member" });
      }
      
      const memberUser = await storage.getUser(updatedMember.userId);
      res.json({
        ...updatedMember,
        user: memberUser ? { ...memberUser, password: undefined } : null,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/team-members/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile not found" });
      }

      const teamMember = await storage.getTeamMember(req.params.id);
      if (!teamMember || teamMember.providerId !== provider.id) {
        return res.status(404).json({ message: "Team member not found" });
      }

      await storage.deleteTeamMember(req.params.id);
      res.json({ message: "Team member removed successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== Claims Routes ==========

  app.post("/api/claims", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      // Convert claimAmount to string if it's a number
      const claimData = {
        ...req.body,
        providerId: provider.id,
        claimAmount: typeof req.body.claimAmount === 'number' 
          ? req.body.claimAmount.toString() 
          : req.body.claimAmount,
      };

      const data = insertClaimSchema.parse(claimData);

      // Step 1: Create claim with submitted status
      let claim = await storage.createClaim(data);

      // Step 2: AI Auto-Coding
      if (claim.rawClaimData) {
        const rawData = claim.rawClaimData;
        claim = await storage.updateClaim(claim.id, { status: "coding" }) || claim;
        
        const codes = await autoCodeClaim(rawData);
        claim = await storage.updateClaim(claim.id, {
          codes,
          status: "coded",
          codedAt: new Date(),
        }) || claim;

        // Step 3: Risk Assessment
        claim = await storage.updateClaim(claim.id, { status: "risk_check" }) || claim;
        
        const providerClaims = await storage.getClaimsByProviderId(provider.id);
        const acceptedClaims = providerClaims.filter(c => c.status === "approved" || c.status === "paid");
        
        const riskScore = await calculateRiskScore(
          Number(claim.claimAmount),
          codes,
          {
            totalClaims: providerClaims.length,
            acceptedClaims: acceptedClaims.length,
            avgClaimAmount: providerClaims.reduce((sum, c) => sum + Number(c.claimAmount), 0) / providerClaims.length,
          }
        );

        claim = await storage.updateClaim(claim.id, {
          riskScore,
          assessedAt: new Date(),
        }) || claim;

        // Step 4: Approval/Rejection based on risk score
        if (riskScore >= 80) {
          const payoutAmount = Number(claim.claimAmount) * 0.95; // 95% payout
          
          claim = await storage.updateClaim(claim.id, {
            status: "approved",
            payoutAmount: payoutAmount.toString(),
          }) || claim;

          // Step 5: Process payment (simplified - in production would use Stripe ACH)
          try {
            // Create a payment intent for the payout
            const paymentIntent = await stripe.paymentIntents.create({
              amount: Math.round(payoutAmount * 100), // Convert to cents
              currency: "usd",
              description: `Claim payout for ${claim.patientName}`,
            });

            // Create transaction record
            const transaction = await storage.createTransaction({
              claimId: claim.id,
              providerId: provider.id,
              amount: payoutAmount.toString(),
              type: "payout",
              status: "completed",
              stripePaymentIntentId: paymentIntent.id,
            });

            // Update transaction with completed timestamp
            await storage.updateTransaction(transaction.id, {
              completedAt: new Date(),
            });

            // Mark claim as paid
            claim = await storage.updateClaim(claim.id, {
              status: "paid",
              paidAt: new Date(),
            }) || claim;
          } catch (stripeError: any) {
            console.error("Stripe payment error:", stripeError);
            // Keep claim as approved but not paid
          }
        } else {
          claim = await storage.updateClaim(claim.id, {
            status: "rejected",
            rejectionReason: `Risk score ${riskScore} below threshold (80 required)`,
          }) || claim;
        }
      }

      res.json(sanitizeClaim(claim));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/claims", requireAuth, async (req, res) => {
    const user = req.user as any;
    const session = req.session as any;
    
    // Validate date range parameter
    const rangeResult = dateRangeSchema.safeParse(req.query.range || "day");
    if (!rangeResult.success) {
      return res.status(400).json({ message: "Invalid date range parameter" });
    }
    const range = rangeResult.data;
    
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    // Validate pagination parameters (allow up to 1000 for filtering scenarios)
    if (page < 1 || limit < 1 || limit > 1000) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }
    
    // Calculate date boundaries
    const now = new Date();
    let startDate = new Date();
    
    switch (range) {
      case "day":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "qtd":
        // Quarter to date
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "ytd":
        // Year to date
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }
    
    // Helper function to filter and paginate claims
    const filterAndPaginate = (claims: any[]) => {
      const filtered = claims.filter(c => new Date(c.submittedAt) >= startDate);
      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);
      return {
        claims: sanitizeClaims(paginated),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };
    
    // Check if impersonating
    if (session.impersonating && session.impersonateId) {
      if (session.impersonatedRole === 'provider') {
        const claims = await storage.getClaimsByProviderId(session.impersonateId);
        return res.json(filterAndPaginate(claims));
      } else if (session.impersonatedRole === 'bank') {
        // Bank users see claims they've funded
        const claims = await storage.getAllClaims(); // TODO: filter by bank
        return res.json(filterAndPaginate(claims));
      }
    }
    
    // Normal flow (not impersonating)
    if (user.role === "provider") {
      const provider = await storage.getProviderByUserId(user.id);
      if (!provider) {
        return res.json({ claims: [], total: 0, page, limit, totalPages: 0 });
      }
      const claims = await storage.getClaimsByProviderId(provider.id);
      res.json(filterAndPaginate(claims));
    } else if (user.role === "admin") {
      const claims = await storage.getAllClaims();
      res.json(filterAndPaginate(claims));
    } else {
      res.json({ claims: [], total: 0, page, limit, totalPages: 0 });
    }
  });

  app.get("/api/claims/:id", requireAuth, async (req, res) => {
    const claim = await storage.getClaim(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }
    res.json(sanitizeClaim(claim));
  });

  // ========== Metrics Routes ==========

  app.get("/api/metrics/provider", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = req.session as any;
      
      // Check if impersonating - use impersonated provider
      let provider;
      if (session.impersonating && session.impersonatedRole === 'provider' && session.impersonateId) {
        provider = await storage.getProvider(session.impersonateId);
      } else {
        provider = await storage.getProviderByUserId(user.id);
      }
      
      if (!provider) {
        return res.json({
          totalSubmitted: 0,
          totalCoded: 0,
          totalAccepted: 0,
          totalRejected: 0,
          totalPaid: 0,
          totalPaidAmount: 0,
          acceptanceRate: 0,
          avgPaymentTime: 0,
        });
      }

      // Validate date range parameter
      const rangeResult = dateRangeSchema.safeParse(req.query.range || "day");
      if (!rangeResult.success) {
        return res.status(400).json({ message: "Invalid date range parameter" });
      }
      const range = rangeResult.data;
      
      // Calculate date boundaries
      const now = new Date();
      let startDate = new Date();
      
      switch (range) {
        case "day":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "qtd":
          // Quarter to date
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case "ytd":
          // Year to date
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }

      const allClaims = await storage.getClaimsByProviderId(provider.id);
      const allTransactions = await storage.getTransactionsByProviderId(provider.id);

      // Filter claims by date range
      const claims = allClaims.filter(c => new Date(c.submittedAt) >= startDate);
      const transactions = allTransactions.filter(t => new Date(t.createdAt) >= startDate);

      const totalSubmitted = claims.length;
      const totalCoded = claims.filter(c => c.codes).length;
      const totalAccepted = claims.filter(c => c.status === "approved" || c.status === "paid").length;
      const totalRejected = claims.filter(c => c.status === "rejected").length;
      const totalPaid = claims.filter(c => c.status === "paid").length;
      const totalPaidAmount = transactions
        .filter(t => t.type === "payout" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const acceptanceRate = totalSubmitted > 0 ? Math.round((totalAccepted / totalSubmitted) * 100) : 0;

      // Calculate avg payment time (simplified)
      const paidClaims = claims.filter(c => c.paidAt);
      const avgPaymentTime = paidClaims.length > 0
        ? Math.round(
            paidClaims.reduce((sum, c) => {
              const hours = (new Date(c.paidAt!).getTime() - new Date(c.submittedAt).getTime()) / (1000 * 60 * 60);
              return sum + hours;
            }, 0) / paidClaims.length
          )
        : 0;

      res.json({
        totalSubmitted,
        totalCoded,
        totalAccepted,
        totalRejected,
        totalPaid,
        totalPaidAmount,
        acceptanceRate,
        avgPaymentTime,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/metrics/admin", requireRole("admin"), async (req, res) => {
    try {
      // Validate date range parameter
      const rangeResult = dateRangeSchema.safeParse(req.query.range || "day");
      if (!rangeResult.success) {
        return res.status(400).json({ message: "Invalid date range parameter" });
      }
      const range = rangeResult.data;
      
      // Calculate date boundaries
      const now = new Date();
      let startDate = new Date();
      
      switch (range) {
        case "day":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "qtd":
          // Quarter to date
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case "ytd":
          // Year to date
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate.setHours(0, 0, 0, 0);
      }

      const providers = await storage.getAllProviders();
      const allClaims = await storage.getAllClaims();

      const activeCustomers = providers.filter(p => p.isActive).length;
      
      // Calculate all transactions within date range
      const allTransactionsPromises = providers.map(p => storage.getTransactionsByProviderId(p.id));
      const allTransactionsArrays = await Promise.all(allTransactionsPromises);
      const allTransactions = allTransactionsArrays.flat()
        .filter(t => new Date(t.createdAt) >= startDate);

      const totalPaymentsOut = allTransactions
        .filter(t => t.type === "payout" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalReimbursementsIn = allTransactions
        .filter(t => t.type === "reimbursement" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const netProfit = totalReimbursementsIn - totalPaymentsOut;

      res.json({
        activeCustomers,
        totalPaymentsOut,
        totalReimbursementsIn,
        netProfit,
        aiUptime: 99.9,
        aiErrorRate: 0.1,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Home Page Metrics
  app.get("/api/metrics/admin/home", requireRole("admin"), async (req, res) => {
    try {
      const rangeResult = dateRangeSchema.safeParse(req.query.range || "day");
      if (!rangeResult.success) {
        return res.status(400).json({ message: "Invalid date range parameter" });
      }
      const range = rangeResult.data;
      
      const now = new Date();
      let startDate = new Date();
      
      switch (range) {
        case "day":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }

      const providers = await storage.getAllProviders();
      const allClaims = await storage.getAllClaims();
      const claimsInRange = allClaims.filter(c => new Date(c.submittedAt) >= startDate);

      const allTransactionsPromises = providers.map(p => storage.getTransactionsByProviderId(p.id));
      const allTransactionsArrays = await Promise.all(allTransactionsPromises);
      const allTransactions = allTransactionsArrays.flat()
        .filter(t => new Date(t.createdAt) >= startDate);

      const totalPaymentsOut = allTransactions
        .filter(t => t.type === "payout" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPaymentsIn = allTransactions
        .filter(t => t.type === "reimbursement" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const grossProfit = totalPaymentsIn - totalPaymentsOut;
      const claimsPurchased = claimsInRange.filter(c => c.status === "paid").length;
      const claimsRejected = claimsInRange.filter(c => c.status === "rejected").length;
      const activeCustomers = providers.filter(p => p.isActive).length;

      // Calculate average payment speed (coding to payment)
      const paidClaims = claimsInRange.filter(c => c.paidAt);
      const avgPaymentSpeed = paidClaims.length > 0
        ? paidClaims.reduce((sum, c) => {
            const hours = (new Date(c.paidAt!).getTime() - new Date(c.submittedAt).getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / paidClaims.length
        : 0;

      res.json({
        totalPaymentsOut,
        totalPaymentsIn,
        grossProfit,
        claimsPurchased,
        claimsRejected,
        activeCustomers,
        aiModelUptime: 99.9,
        errorRate: 0.1,
        processingSpeed: 1.2,
        paymentSpeed: avgPaymentSpeed,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transactions Page Metrics
  app.get("/api/metrics/transactions", requireRole("admin"), async (req, res) => {
    try {
      const rangeResult = dateRangeSchema.safeParse(req.query.range || "day");
      if (!rangeResult.success) {
        return res.status(400).json({ message: "Invalid date range parameter" });
      }
      const range = rangeResult.data;
      
      const now = new Date();
      let startDate = new Date();
      
      switch (range) {
        case "day":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }

      const providers = await storage.getAllProviders();
      const allClaims = await storage.getAllClaims();
      const claimsInRange = allClaims.filter(c => new Date(c.submittedAt) >= startDate);

      const allTransactionsPromises = providers.map(p => storage.getTransactionsByProviderId(p.id));
      const allTransactionsArrays = await Promise.all(allTransactionsPromises);
      const allTransactions = allTransactionsArrays.flat()
        .filter(t => new Date(t.createdAt) >= startDate);

      const totalPaymentsOut = allTransactions
        .filter(t => t.type === "payout" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalPaymentsIn = allTransactions
        .filter(t => t.type === "reimbursement" && t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const grossProfit = totalPaymentsIn - totalPaymentsOut;
      const netProfit = grossProfit; // In real scenario, this would account for adjustments and disputes

      // Calculate A/R metrics
      const unreimbursedClaims = allClaims.filter(c => c.status === "paid" && !c.reimbursedAt);
      const arBalance = unreimbursedClaims.reduce((sum, c) => sum + Number(c.claimAmount || 0), 0);
      
      const reimbursedClaims = claimsInRange.filter(c => c.reimbursedAt);
      const arDays = reimbursedClaims.length > 0
        ? reimbursedClaims.reduce((sum, c) => {
            const days = (new Date(c.reimbursedAt!).getTime() - new Date(c.paidAt!).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / reimbursedClaims.length
        : 0;

      const claimsPaid = claimsInRange.filter(c => c.status === "paid").length;
      const claimsDenied = claimsInRange.filter(c => c.status === "denied" || c.status === "rejected").length;

      // Calculate ARPC (Average Revenue Per Customer)
      const activeCustomers = providers.filter(p => p.isActive).length;
      const averageRevenuePerCustomer = activeCustomers > 0 ? grossProfit / activeCustomers : 0;

      // Calculate CLV (Customer Lifetime Value)
      // If churn rate is 0, assume 60 month lifetime
      const churnRate = 0; // Would calculate from actual customer data
      const customerLifetimeValue = churnRate === 0 
        ? averageRevenuePerCustomer * 60 
        : averageRevenuePerCustomer / churnRate;

      res.json({
        totalPaymentsOut,
        totalPaymentsIn,
        grossProfit,
        netProfit,
        arBalance,
        arDays,
        claimsPaid,
        claimsDenied,
        averageRevenuePerCustomer,
        customerLifetimeValue,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/metrics/bank", requireAuth, async (req, res) => {
    const user = req.user as any;
    const session = req.session as any;
    
    // Validate date range parameter
    const rangeResult = dateRangeSchema.safeParse(req.query.range || "day");
    if (!rangeResult.success) {
      return res.status(400).json({ message: "Invalid date range parameter" });
    }
    const range = rangeResult.data;
    
    // Check if impersonating bank or is actual bank user
    if (session.impersonating && session.impersonatedRole === 'bank' && session.impersonateId) {
      // Admin impersonating bank - return bank metrics
      const bank = await storage.getBank(session.impersonateId);
      if (!bank) {
        return res.status(404).json({ message: "Bank not found" });
      }
      
      // TODO: Calculate real metrics based on bank's funding data and date range
      // Currently returning mock data - will use range parameter when implementing real metrics
      return res.json({
        totalFunded: 5000000,
        outstanding: 1200000,
        defaultRate: 0.5,
        projectedROI: 2.1,
      });
    }
    
    // Normal bank user
    if (user.role !== 'bank') {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json({
      totalFunded: 5000000,
      outstanding: 1200000,
      defaultRate: 0.5,
      projectedROI: 2.1,
    });
  });

  // ========== Admin Routes ==========

  app.get("/api/admin/providers", requireRole("admin"), async (req, res) => {
    const providers = await storage.getAllProviders();
    
    // SECURITY: Never expose sensitive credentials even to admins
    const safeProviders = providers.map(redactProviderSecrets);
    res.json(safeProviders);
  });

  // Get all customers/providers with metrics
  app.get("/api/admin/customers", requireRole("admin"), async (req, res) => {
    try {
      const providers = await storage.getAllProviders();
      
      const customersWithMetrics = await Promise.all(
        providers.map(async (provider) => {
          const claims = await storage.getClaimsByProviderId(provider.id);
          const transactions = await storage.getTransactionsByProviderId(provider.id);
          
          const totalClaims = claims.length;
          const approvedClaims = claims.filter(c => c.status === 'approved' || c.status === 'paid').length;
          const rejectedClaims = claims.filter(c => c.status === 'rejected').length;
          
          const totalPayouts = transactions
            .filter(t => t.type === 'payout' && t.status === 'completed')
            .reduce((sum, t) => sum + Number(t.amount), 0);
          
          const totalReimbursements = transactions
            .filter(t => t.type === 'reimbursement' && t.status === 'completed')
            .reduce((sum, t) => sum + Number(t.amount), 0);
          
          const netPL = totalReimbursements - totalPayouts;
          
          return {
            id: provider.id,
            providerName: provider.providerName,
            npi: provider.npi,
            contactEmail: provider.contactEmail,
            isActive: provider.isActive,
            totalClaims,
            approvedClaims,
            rejectedClaims,
            totalPayouts,
            totalReimbursements,
            netPL,
            createdAt: provider.createdAt,
          };
        })
      );
      
      res.json(customersWithMetrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single customer/provider details
  app.get("/api/admin/customers/:id", requireRole("admin"), async (req, res) => {
    try {
      const provider = await storage.getProviderWithDetails(req.params.id);
      
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      const claims = await storage.getClaimsByProviderId(req.params.id);
      const transactions = await storage.getTransactionsByProviderId(req.params.id);
      const fundingAgreements = await storage.getFundingAgreementsByProviderId(req.params.id);
      const teamMembers = await storage.getTeamMembersByProviderId(req.params.id);
      
      // Get detailed user info for team members
      const teamMembersWithUserInfo = await Promise.all(
        teamMembers.map(async (tm) => {
          const user = await storage.getUser(tm.userId);
          if (!user) return null;
          const { password, ...safeUser } = user;
          return {
            ...tm,
            user: safeUser,
          };
        })
      );
      
      // Filter out any null entries
      const validTeamMembers = teamMembersWithUserInfo.filter(tm => tm !== null);
      
      // Calculate metrics
      const totalClaims = claims.length;
      const approvedClaims = claims.filter(c => c.status === 'approved').length;
      const rejectedClaims = claims.filter(c => c.status === 'rejected').length;
      const successRate = totalClaims > 0 ? (approvedClaims / totalClaims) * 100 : 0;
      
      const totalPayouts = transactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const totalReimbursements = transactions
        .filter(t => t.type === 'reimbursement')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      // Get funding sources with bank details
      const fundingSourcesWithBankInfo = await Promise.all(
        fundingAgreements.map(async (fa) => {
          const bank = await storage.getBankByUserId(fa.bankUserId);
          return {
            ...fa,
            bankContactName: bank ? bank.contactName : 'Unknown',
            bankEmail: bank ? bank.contactEmail : null,
            bankInstitutionName: bank ? bank.bankName : 'Unknown',
          };
        })
      );
      
      res.json({
        provider,
        claims,
        transactions,
        fundingAgreements: fundingSourcesWithBankInfo,
        teamMembers: validTeamMembers,
        metrics: {
          totalClaims,
          approvedClaims,
          rejectedClaims,
          successRate,
          totalPayouts,
          totalReimbursements,
          netPL: totalReimbursements - totalPayouts,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all funding sources (banks)
  app.get("/api/admin/funding-sources", requireRole("admin"), async (req, res) => {
    try {
      const banks = await storage.getAllBanks();
      
      const banksWithMetrics = await Promise.all(
        banks.map(async (bank) => {
          const fundingAgreements = await storage.getFundingAgreementsByBankId(bank.id);
          
          const totalFunded = fundingAgreements
            .reduce((sum, fa) => sum + Number(fa.fundingAmount), 0);
          
          const activeFunding = fundingAgreements
            .filter(fa => fa.status === 'active')
            .reduce((sum, fa) => sum + Number(fa.fundingAmount), 0);
          
          const settledFunding = fundingAgreements
            .filter(fa => fa.status === 'settled')
            .reduce((sum, fa) => sum + Number(fa.fundingAmount), 0);
          
          return {
            id: bank.id,
            name: `${bank.firstName} ${bank.lastName}`,
            email: bank.email,
            totalFunded,
            activeFunding,
            settledFunding,
            totalProviders: fundingAgreements.length,
            createdAt: bank.createdAt,
          };
        })
      );
      
      res.json(banksWithMetrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all admin and bank users
  app.get("/api/admin/all-users", requireRole("admin"), async (req, res) => {
    try {
      const users = await storage.getAllAdminAndBankUsers();
      // Redact sensitive fields before returning
      const sanitizedUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      res.json(sanitizedUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get global user statistics
  app.get("/api/admin/users/stats", requireRole("admin"), async (req, res) => {
    try {
      const allUsers = await storage.searchUsers({
        page: 1,
        limit: 100000, // Get all users for accurate stats
      });

      const stats = {
        total: allUsers.total,
        active: allUsers.users.filter(u => u.status === 'approved').length,
        suspended: allUsers.users.filter(u => u.status === 'suspended').length,
        pending: allUsers.users.filter(u => u.status === 'pending').length,
        byRole: {
          admin: allUsers.users.filter(u => u.role === 'admin').length,
          bank: allUsers.users.filter(u => u.role === 'bank').length,
          provider: allUsers.users.filter(u => u.role === 'provider').length,
        }
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Advanced user search with filters and pagination
  app.get("/api/admin/users", requireRole("admin"), async (req, res) => {
    try {
      const result = await storage.searchUsers({
        userType: req.query.userType as string,
        status: req.query.status as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      });

      // Redact passwords
      const sanitizedUsers = result.users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json({
        ...result,
        users: sanitizedUsers,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user internal role (super admin only)
  app.put("/api/admin/users/:id/role", requireRole("admin"), async (req, res) => {
    try {
      const currentUser = req.user as User;
      
      // Only super admins can change roles
      if (currentUser.role !== "admin" || currentUser.internalRole !== "super_admin") {
        return res.status(403).json({ 
          message: "Only super admins can assign internal roles" 
        });
      }

      const { internalRole } = req.body;
      
      if (!["super_admin", "admin", "team_member"].includes(internalRole)) {
        return res.status(400).json({ message: "Invalid internal role" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only internal (admin role) users can have internal roles
      if (targetUser.role !== "admin") {
        return res.status(400).json({ 
          message: "Internal roles can only be assigned to admin users" 
        });
      }

      const oldRole = targetUser.internalRole;
      const updatedUser = await storage.updateUser(req.params.id, { internalRole });

      // Log the role change
      await logRoleAssigned(currentUser.id, req.params.id, oldRole, internalRole, req);

      const { password, ...safeUser } = updatedUser!;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk update users
  app.post("/api/admin/users/bulk-update", requireRole("admin"), async (req, res) => {
    try {
      const { userIds, data } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }

      // Don't allow role changes via bulk update (use specific endpoint)
      const { internalRole, role, password, ...safeData } = data;

      await storage.bulkUpdateUsers(userIds, safeData);

      // Log bulk operation
      const currentUser = req.user as User;
      await logBulkOperation(currentUser.id, 'update', userIds, req);

      res.json({ message: `Successfully updated ${userIds.length} users` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk suspend users
  app.post("/api/admin/users/bulk-suspend", requireRole("admin"), async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }

      await storage.bulkUpdateUsers(userIds, { status: 'suspended' });

      // Log bulk operation
      const currentUser = req.user as User;
      await logBulkOperation(currentUser.id, 'suspend', userIds, req);

      res.json({ message: `Successfully suspended ${userIds.length} users` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk activate users
  app.post("/api/admin/users/bulk-activate", requireRole("admin"), async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }

      await storage.bulkUpdateUsers(userIds, { status: 'approved' });

      // Log bulk operation
      const currentUser = req.user as User;
      await logBulkOperation(currentUser.id, 'activate', userIds, req);

      res.json({ message: `Successfully activated ${userIds.length} users` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get audit logs
  app.get("/api/admin/audit-logs", requireRole("admin"), async (req, res) => {
    try {
      const result = await storage.getAuditLogs({
        userId: req.query.userId as string,
        targetId: req.query.targetId as string,
        action: req.query.action as string,
        from: req.query.from ? new Date(req.query.from as string) : undefined,
        to: req.query.to ? new Date(req.query.to as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user details
  app.put("/api/admin/users/:id", requireRole("admin"), async (req, res) => {
    try {
      const { firstName, lastName, email, status } = req.body;
      const currentUser = req.user as User;
      
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updates: Partial<User> = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (status !== undefined) updates.status = status;

      const updatedUser = await storage.updateUser(req.params.id, updates);

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }

      // Log the update
      await logUserUpdated(currentUser.id, req.params.id, targetUser, updatedUser, req);

      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user permissions
  app.get("/api/admin/users/:id/permissions", requireRole("admin"), async (req, res) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get permissions based on user's internal role or regular role
      const roleToCheck = targetUser.internalRole || targetUser.role;
      const permissions = await storage.getPermissionsByRole(roleToCheck);
      
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export users to CSV
  app.get("/api/admin/users/export", requireRole("admin"), async (req, res) => {
    try {
      const result = await storage.searchUsers({
        userType: req.query.userType as string,
        status: req.query.status as string,
        search: req.query.search as string,
        page: 1,
        limit: 10000, // Get all results for export
      });

      // Create CSV
      const headers = ['ID', 'Username', 'Email', 'First Name', 'Last Name', 'Role', 'Internal Role', 'Status', 'Created At', 'Last Login'];
      const csvRows = [headers.join(',')];

      result.users.forEach(user => {
        const row = [
          user.id,
          user.username,
          user.email,
          user.firstName || '',
          user.lastName || '',
          user.role,
          user.internalRole || '',
          user.status,
          user.createdAt?.toISOString() || '',
          user.lastLogin?.toISOString() || '',
        ];
        csvRows.push(row.map(field => `"${field}"`).join(','));
      });

      const csv = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== Bank Portal Routes ==========

  // Get all providers funded by this bank
  app.get("/api/bank/providers", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = req.session as any;
      
      // Determine bank user ID (either impersonated or real bank user)
      let bankUserId;
      if (session.impersonating && session.impersonatedRole === 'bank' && session.impersonateId) {
        const bank = await storage.getBank(session.impersonateId);
        if (!bank) {
          return res.status(404).json({ message: "Bank not found" });
        }
        bankUserId = bank.userId;
      } else if (user.role === 'bank') {
        bankUserId = user.id;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const fundingAgreements = await storage.getFundingAgreementsByBankId(bankUserId);
      res.json(fundingAgreements);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get provider details for bank portal
  app.get("/api/bank/providers/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const session = req.session as any;
      
      // Determine bank user ID (either impersonated or real bank user)
      let bankUserId;
      if (session.impersonating && session.impersonatedRole === 'bank' && session.impersonateId) {
        const bank = await storage.getBank(session.impersonateId);
        if (!bank) {
          return res.status(404).json({ message: "Bank not found" });
        }
        bankUserId = bank.userId;
      } else if (user.role === 'bank') {
        bankUserId = user.id;
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const fundingAgreements = await storage.getFundingAgreementsByBankId(bankUserId);
      
      // Verify bank has funding relationship with this provider
      const hasFunding = fundingAgreements.some(fa => fa.providerId === req.params.id);
      if (!hasFunding) {
        return res.status(403).json({ message: "No funding relationship with this provider" });
      }
      
      const provider = await storage.getProviderWithDetails(req.params.id);
      const claims = await storage.getClaimsByProviderId(req.params.id);
      const transactions = await storage.getTransactionsByProviderId(req.params.id);
      
      res.json({
        provider: redactProviderSecrets(provider),
        claims,
        transactions,
        fundingAgreements: fundingAgreements.filter(fa => fa.providerId === req.params.id),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== Historical Claims Upload ==========

  app.post("/api/historical-claims/upload", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      // In a real implementation, would parse uploaded file
      // For now, just create a record
      const historicalClaim = await storage.createHistoricalClaim({
        providerId: provider.id,
        claimData: { uploaded: true },
      });

      res.json(historicalClaim);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== Team Members ==========

  app.post("/api/team-members", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      // In a real implementation, would send invite email
      // For now, just create a placeholder
      res.json({ message: "Team member invite sent" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== Stripe Payment Intent (for future ACH integration) ==========

  app.post("/api/create-payment-intent", requireAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // ========== EHR Integration Routes ==========

  // Test EHR connection
  app.post("/api/ehr/test-connection", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      if (!provider.ehrEnabled) {
        return res.status(400).json({ message: "EHR integration not enabled" });
      }

      const isConnected = await testEHRConnection(provider);
      res.json({ 
        connected: isConnected,
        ehrSystem: provider.ehrSystem,
        message: isConnected ? "Connection successful" : "Connection failed"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger EHR sync
  app.post("/api/ehr/sync", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      if (!provider.ehrEnabled) {
        return res.status(400).json({ message: "EHR integration not enabled" });
      }

      const processedCount = await ehrSyncService.syncProvider(provider.id);
      res.json({ 
        message: "Sync completed",
        processedClaims: processedCount,
        lastSync: new Date()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get EHR sync status
  app.get("/api/ehr/status", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      res.json({
        ehrEnabled: provider.ehrEnabled,
        ehrSystem: provider.ehrSystem,
        lastSync: provider.ehrLastSync,
        syncServiceStatus: ehrSyncService.getStatus()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== EHR Emulator Routes (Testing) ==========

  // Get sample patients
  app.get("/api/ehr-emulator/patients", requireAuth, async (req, res) => {
    try {
      const patients = ehrEmulator.getPatients();
      res.json(patients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate random encounters
  app.post("/api/ehr-emulator/generate", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      const { count = 1 } = req.body;
      const encounters = ehrEmulator.generateMultipleEncounters(count);
      
      res.json({ 
        message: `Generated ${encounters.length} encounters`,
        encounters 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Enable emulator for provider
  app.post("/api/ehr-emulator/enable", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      ehrEmulator.enableForProvider(provider.id);
      
      res.json({ 
        message: "EHR Emulator enabled for testing",
        enabled: true
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Disable emulator for provider
  app.post("/api/ehr-emulator/disable", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      ehrEmulator.disableForProvider(provider.id);
      
      res.json({ 
        message: "EHR Emulator disabled",
        enabled: false
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get emulator status
  app.get("/api/ehr-emulator/status", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      
      if (!provider) {
        return res.status(400).json({ message: "Provider profile required" });
      }

      const enabled = ehrEmulator.isEnabledForProvider(provider.id);
      const encounterCount = ehrEmulator.getEncounterCount();
      
      res.json({ 
        enabled,
        encounterCount,
        patients: ehrEmulator.getPatients().length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear emulator encounters
  app.post("/api/ehr-emulator/clear", requireAuth, async (req, res) => {
    try {
      ehrEmulator.clearEncounters();
      res.json({ message: "Emulator encounters cleared" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== Invitation Routes ==========
  
  // Send invitation (admin/bank only)
  app.post("/api/invitations/send", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'bank') {
        return res.status(403).json({ message: "Only admins and bank users can send invitations" });
      }

      const { email, firstName, lastName, role } = req.body;

      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({ message: "Email, first name, last name, and role are required" });
      }

      if (role !== 'admin' && role !== 'bank') {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate unique token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const invitation = await storage.createInvitation({
        email,
        firstName,
        lastName,
        role,
        token,
        invitedBy: user.id,
        expiresAt,
        status: 'pending',
      });

      // Send invitation email
      const invitationLink = `${req.protocol}://${req.get('host')}/invitation/accept?token=${token}`;
      await sendInvitationEmail(email, firstName, lastName, role, invitationLink, `${user.firstName} ${user.lastName}`);

      res.json({
        message: "Invitation sent successfully",
        invitation: {
          ...invitation,
          token: undefined, // Don't expose token in response
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending approvals for current user (must be before :token route)
  app.get("/api/invitations/pending", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const pendingInvitations = await storage.getPendingInvitationsByInviter(user.id);
      res.json(pendingInvitations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get invitation by token (public)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation already used" });
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ message: "Invitation expired" });
      }

      res.json({
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: invitation.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept invitation and create account
  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation already used" });
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Create user account (pending approval)
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username: invitation.email,
        email: invitation.email,
        password: hashedPassword,
        role: invitation.role,
        status: 'pending',
        invitedBy: invitation.invitedBy,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
      });

      // Update invitation status
      await storage.updateInvitation(invitation.id, {
        status: 'accepted',
        userId: newUser.id,
        acceptedAt: new Date(),
      });

      // Get inviter details
      const inviter = await storage.getUser(invitation.invitedBy);
      
      // Send approval request email to inviter
      const approvalLink = `${req.protocol}://${req.get('host')}/api/invitations/approve/${invitation.id}`;
      const denyLink = `${req.protocol}://${req.get('host')}/api/invitations/deny/${invitation.id}`;
      
      if (inviter) {
        await sendApprovalRequestEmail(
          inviter.email,
          invitation.firstName,
          invitation.lastName,
          invitation.role,
          approvalLink,
          denyLink
        );
      }

      res.json({
        message: "Account created successfully. Pending approval.",
        status: 'pending',
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve invitation
  app.post("/api/invitations/approve/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const invitation = await storage.updateInvitation(req.params.id, {
        status: 'approved',
        approvedAt: new Date(),
      });

      if (!invitation || !invitation.userId) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Update user status to approved
      await storage.updateUser(invitation.userId, { status: 'approved' });

      // Get the new user
      const newUser = await storage.getUser(invitation.userId);
      
      // Send approval email
      const loginLink = `${req.protocol}://${req.get('host')}`;
      if (newUser) {
        await sendAccountApprovedEmail(
          newUser.email,
          newUser.firstName || invitation.firstName,
          invitation.role,
          loginLink
        );
      }

      res.json({ message: "User approved successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Deny invitation
  app.post("/api/invitations/deny/:id", requireAuth, async (req, res) => {
    try {
      const invitation = await storage.updateInvitation(req.params.id, {
        status: 'rejected',
      });

      if (!invitation || !invitation.userId) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Update user status to rejected
      await storage.updateUser(invitation.userId, { status: 'rejected' });

      // Get the user
      const rejectedUser = await storage.getUser(invitation.userId);
      
      // Send rejection email
      if (rejectedUser) {
        await sendAccountRejectedEmail(
          rejectedUser.email,
          rejectedUser.firstName || invitation.firstName
        );
      }

      res.json({ message: "User denied successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  // Seed RBAC (permissions, roles, role-permissions)
  await seedRBAC();

  // Initialize and start EHR sync service
  const ehrSyncService = new EHRSyncService(storage);
  ehrSyncService.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, stopping EHR sync service...');
    ehrSyncService.stop();
  });

  return httpServer;
}
