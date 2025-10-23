// javascript_database integration - DatabaseStorage implementation
import {
  users,
  providers,
  banks,
  claims,
  transactions,
  historicalClaims,
  teamMembers,
  invitations,
  fundingAgreements,
  permissions,
  roles,
  rolePermissions,
  type User,
  type InsertUser,
  type Provider,
  type InsertProvider,
  type Bank,
  type InsertBank,
  type Claim,
  type InsertClaim,
  type Transaction,
  type InsertTransaction,
  type HistoricalClaim,
  type InsertHistoricalClaim,
  type TeamMember,
  type InsertTeamMember,
  type Invitation,
  type InsertInvitation,
  type FundingAgreement,
  type InsertFundingAgreement,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, or, like, inArray, count, gte, lte } from "drizzle-orm";
import { auditLogs } from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllAdminAndBankUsers(): Promise<User[]>;
  searchUsers(filters: {
    userType?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number; page: number; totalPages: number }>;
  bulkUpdateUsers(userIds: string[], data: Partial<User>): Promise<void>;
  getAuditLogs(filters: {
    userId?: string;
    targetId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }): Promise<any>;

  // Providers
  getProvider(id: string): Promise<Provider | undefined>;
  getProviderByUserId(userId: string): Promise<Provider | undefined>;
  getProviderByNpi(npi: string): Promise<Provider | undefined>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  updateProvider(id: string, data: Partial<Provider>): Promise<Provider | undefined>;
  getAllProviders(): Promise<Provider[]>;

  // Banks
  getBank(id: string): Promise<Bank | undefined>;
  getBankByUserId(userId: string): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: string, data: Partial<Bank>): Promise<Bank | undefined>;

  // Claims
  getClaim(id: string): Promise<Claim | undefined>;
  getClaimsByProviderId(providerId: string): Promise<Claim[]>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  updateClaim(id: string, data: Partial<Claim>): Promise<Claim | undefined>;
  getAllClaims(): Promise<Claim[]>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByProviderId(providerId: string): Promise<Transaction[]>;
  getTransactionsByClaimId(claimId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | undefined>;

  // Historical Claims
  createHistoricalClaim(historicalClaim: InsertHistoricalClaim): Promise<HistoricalClaim>;
  getHistoricalClaimsByProviderId(providerId: string): Promise<HistoricalClaim[]>;

  // Team Members
  createTeamMember(teamMember: InsertTeamMember): Promise<TeamMember>;
  getTeamMembersByProviderId(providerId: string): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  updateTeamMember(id: string, data: Partial<TeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<void>;

  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationsByInviter(inviterId: string): Promise<Invitation[]>;
  getPendingInvitationsByInviter(inviterId: string): Promise<Invitation[]>;
  updateInvitation(id: string, data: Partial<Invitation>): Promise<Invitation | undefined>;
  getAllPendingApprovals(role: string): Promise<Invitation[]>;

  // Funding Agreements
  getFundingAgreementsByBankId(bankId: string): Promise<any[]>;
  getFundingAgreementsByProviderId(providerId: string): Promise<any[]>;
  createFundingAgreement(agreement: any): Promise<any>;

  // Admin & Bank Portal
  getAllBanks(): Promise<User[]>;
  getProviderWithDetails(providerId: string): Promise<any>;

  // Portal Switching & Impersonation
  getMostActiveProvider(since: Date): Promise<any | null>;
  getMostActiveBank(since: Date): Promise<any | null>;
  getProviderEntities(search: string | undefined, since: Date): Promise<any[]>;
  getBankEntities(search: string | undefined, since: Date): Promise<any[]>;

  // RBAC
  getPermissionsByRole(roleName: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllAdminAndBankUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(sql`${users.role} IN ('admin', 'bank') AND ${users.status} = 'approved'`)
      .orderBy(desc(users.createdAt));
  }

  async searchUsers(filters: {
    userType?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number; page: number; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    
    if (filters.userType) {
      conditions.push(eq(users.role, filters.userType));
    }
    
    if (filters.status) {
      conditions.push(eq(users.status, filters.status));
    }
    
    if (filters.search) {
      conditions.push(
        or(
          like(users.email, `%${filters.search}%`),
          like(users.username, `%${filters.search}%`),
          like(users.firstName, `%${filters.search}%`),
          like(users.lastName, `%${filters.search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    // Get paginated results
    const usersList = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      users: usersList,
      total: Number(totalCount),
      page,
      totalPages: Math.ceil(Number(totalCount) / limit),
    };
  }

  async bulkUpdateUsers(userIds: string[], data: Partial<User>): Promise<void> {
    if (userIds.length === 0) return;
    
    await db
      .update(users)
      .set(data)
      .where(inArray(users.id, userIds));
  }

  async getAuditLogs(filters: {
    userId?: string;
    targetId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    
    if (filters.targetId) {
      conditions.push(eq(auditLogs.targetId, filters.targetId));
    }
    
    if (filters.action) {
      conditions.push(like(auditLogs.action, `%${filters.action}%`));
    }
    
    if (filters.from) {
      conditions.push(gte(auditLogs.createdAt, filters.from));
    }
    
    if (filters.to) {
      conditions.push(lte(auditLogs.createdAt, filters.to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    // Get paginated results
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs,
      total: Number(totalCount),
      page,
      totalPages: Math.ceil(Number(totalCount) / limit),
    };
  }

  // Providers
  async getProvider(id: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider || undefined;
  }

  async getProviderByUserId(userId: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.userId, userId));
    return provider || undefined;
  }

  async getProviderByNpi(npi: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.npi, npi));
    return provider || undefined;
  }

  async createProvider(insertProvider: InsertProvider): Promise<Provider> {
    const [provider] = await db.insert(providers).values(insertProvider).returning();
    return provider;
  }

  async updateProvider(id: string, data: Partial<Provider>): Promise<Provider | undefined> {
    const [provider] = await db.update(providers).set(data).where(eq(providers.id, id)).returning();
    return provider || undefined;
  }

  async getAllProviders(): Promise<Provider[]> {
    return await db.select().from(providers).orderBy(desc(providers.createdAt));
  }

  // Banks
  async getBank(id: string): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.id, id));
    return bank || undefined;
  }

  async getBankByUserId(userId: string): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.userId, userId));
    return bank || undefined;
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const [bank] = await db.insert(banks).values(insertBank).returning();
    return bank;
  }

  async updateBank(id: string, data: Partial<Bank>): Promise<Bank | undefined> {
    const [bank] = await db.update(banks).set(data).where(eq(banks.id, id)).returning();
    return bank || undefined;
  }

  // Claims
  async getClaim(id: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim || undefined;
  }

  async getClaimsByProviderId(providerId: string): Promise<Claim[]> {
    return await db
      .select()
      .from(claims)
      .where(eq(claims.providerId, providerId))
      .orderBy(desc(claims.submittedAt));
  }

  async createClaim(insertClaim: InsertClaim): Promise<Claim> {
    const [claim] = await db.insert(claims).values(insertClaim).returning();
    return claim;
  }

  async updateClaim(id: string, data: Partial<Claim>): Promise<Claim | undefined> {
    const [claim] = await db.update(claims).set(data).where(eq(claims.id, id)).returning();
    return claim || undefined;
  }

  async getAllClaims(): Promise<Claim[]> {
    return await db.select().from(claims).orderBy(desc(claims.submittedAt));
  }

  // Transactions
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async getTransactionsByProviderId(providerId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.providerId, providerId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByClaimId(claimId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.claimId, claimId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, id))
      .returning();
    return transaction || undefined;
  }

  // Historical Claims
  async createHistoricalClaim(insertHistoricalClaim: InsertHistoricalClaim): Promise<HistoricalClaim> {
    const [historicalClaim] = await db.insert(historicalClaims).values(insertHistoricalClaim).returning();
    return historicalClaim;
  }

  async getHistoricalClaimsByProviderId(providerId: string): Promise<HistoricalClaim[]> {
    return await db
      .select()
      .from(historicalClaims)
      .where(eq(historicalClaims.providerId, providerId))
      .orderBy(desc(historicalClaims.uploadedAt));
  }

  // Team Members
  async createTeamMember(insertTeamMember: InsertTeamMember): Promise<TeamMember> {
    const [teamMember] = await db.insert(teamMembers).values(insertTeamMember).returning();
    return teamMember;
  }

  async getTeamMembersByProviderId(providerId: string): Promise<TeamMember[]> {
    return await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.providerId, providerId))
      .orderBy(desc(teamMembers.invitedAt));
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [teamMember] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return teamMember || undefined;
  }

  async updateTeamMember(id: string, data: Partial<TeamMember>): Promise<TeamMember | undefined> {
    const [teamMember] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
    return teamMember || undefined;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  // Invitations
  async createInvitation(insertInvitation: InsertInvitation): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values(insertInvitation).returning();
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token));
    return invitation || undefined;
  }

  async getInvitationsByInviter(inviterId: string): Promise<Invitation[]> {
    return await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitedBy, inviterId))
      .orderBy(desc(invitations.createdAt));
  }

  async getPendingInvitationsByInviter(inviterId: string): Promise<Invitation[]> {
    return await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.invitedBy, inviterId), eq(invitations.status, 'accepted')))
      .orderBy(desc(invitations.acceptedAt));
  }

  async updateInvitation(id: string, data: Partial<Invitation>): Promise<Invitation | undefined> {
    const [invitation] = await db.update(invitations).set(data).where(eq(invitations.id, id)).returning();
    return invitation || undefined;
  }

  async getAllPendingApprovals(role: string): Promise<Invitation[]> {
    return await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.role, role), eq(invitations.status, 'accepted')))
      .orderBy(desc(invitations.acceptedAt));
  }

  // Funding Agreements
  async getFundingAgreementsByBankId(bankId: string): Promise<any[]> {
    const agreements = await db
      .select({
        id: fundingAgreements.id,
        providerId: fundingAgreements.providerId,
        fundingAmount: fundingAgreements.fundingAmount,
        feeRate: fundingAgreements.feeRate,
        status: fundingAgreements.status,
        fundedAt: fundingAgreements.fundedAt,
        settledAt: fundingAgreements.settledAt,
        providerName: providers.providerName,
        npi: providers.npi,
      })
      .from(fundingAgreements)
      .leftJoin(providers, eq(fundingAgreements.providerId, providers.id))
      .where(eq(fundingAgreements.bankId, bankId))
      .orderBy(desc(fundingAgreements.fundedAt));
    
    return agreements;
  }

  async getFundingAgreementsByProviderId(providerId: string): Promise<any[]> {
    const agreements = await db
      .select({
        id: fundingAgreements.id,
        bankId: fundingAgreements.bankId,
        fundingAmount: fundingAgreements.fundingAmount,
        feeRate: fundingAgreements.feeRate,
        status: fundingAgreements.status,
        fundedAt: fundingAgreements.fundedAt,
        settledAt: fundingAgreements.settledAt,
        bankName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(fundingAgreements)
      .leftJoin(users, eq(fundingAgreements.bankId, users.id))
      .where(eq(fundingAgreements.providerId, providerId))
      .orderBy(desc(fundingAgreements.fundedAt));
    
    return agreements;
  }

  async createFundingAgreement(agreement: InsertFundingAgreement): Promise<FundingAgreement> {
    const [fundingAgreement] = await db.insert(fundingAgreements).values(agreement).returning();
    return fundingAgreement;
  }

  // Admin & Bank Portal
  async getAllBanks(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'bank'), eq(users.status, 'approved')))
      .orderBy(users.firstName);
  }

  async getProviderWithDetails(providerId: string): Promise<any> {
    const [provider] = await db
      .select({
        id: providers.id,
        userId: providers.userId,
        providerName: providers.providerName,
        npi: providers.npi,
        tin: providers.tin,
        firstName: providers.firstName,
        lastName: providers.lastName,
        contactPhone: providers.contactPhone,
        contactEmail: providers.contactEmail,
        commissionRate: providers.commissionRate,
        isActive: providers.isActive,
        createdAt: providers.createdAt,
      })
      .from(providers)
      .where(eq(providers.id, providerId));
    
    return provider;
  }

  // Portal Switching & Impersonation
  async getMostActiveProvider(since: Date): Promise<any | null> {
    const result = await db
      .select({
        id: providers.id,
        providerName: providers.providerName,
        firstName: providers.firstName,
        lastName: providers.lastName,
        claimCount: count(claims.id),
        totalPaid: sql<string>`COALESCE(SUM(${claims.payoutAmount}), 0)`,
      })
      .from(providers)
      .leftJoin(claims, and(
        eq(claims.providerId, providers.id),
        eq(claims.status, 'paid'),
        gte(claims.paidAt, since)
      ))
      .where(eq(providers.isActive, true))
      .groupBy(providers.id)
      .orderBy(desc(count(claims.id)), desc(sql`COALESCE(SUM(${claims.payoutAmount}), 0)`))
      .limit(1);
    
    return result[0] || null;
  }

  async getMostActiveBank(since: Date): Promise<any | null> {
    const result = await db
      .select({
        id: banks.id,
        bankName: banks.bankName,
        totalValue: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
        transactionCount: count(transactions.id),
      })
      .from(banks)
      .leftJoin(users, eq(banks.userId, users.id))
      .leftJoin(transactions, and(
        eq(transactions.bankId, users.id),
        gte(transactions.createdAt, since)
      ))
      .where(eq(banks.isActive, true))
      .groupBy(banks.id)
      .orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`), desc(count(transactions.id)))
      .limit(1);
    
    return result[0] || null;
  }

  async getProviderEntities(search: string | undefined, since: Date): Promise<any[]> {
    const conditions = [eq(providers.isActive, true)];
    
    if (search) {
      conditions.push(
        or(
          like(providers.providerName, `%${search}%`),
          like(providers.firstName, `%${search}%`),
          like(providers.lastName, `%${search}%`),
          like(providers.npi, `%${search}%`)
        )!
      );
    }

    const result = await db
      .select({
        id: providers.id,
        name: sql<string>`COALESCE(${providers.providerName}, ${providers.firstName} || ' ' || ${providers.lastName})`,
        email: providers.contactEmail,
        activityMetric: count(claims.id),
      })
      .from(providers)
      .leftJoin(claims, and(
        eq(claims.providerId, providers.id),
        eq(claims.status, 'paid'),
        gte(claims.paidAt, since)
      ))
      .where(and(...conditions))
      .groupBy(providers.id)
      .orderBy(desc(count(claims.id)))
      .limit(50);
    
    return result;
  }

  async getBankEntities(search: string | undefined, since: Date): Promise<any[]> {
    const conditions = [eq(banks.isActive, true)];
    
    if (search) {
      conditions.push(
        or(
          like(banks.bankName, `%${search}%`),
          like(banks.contactEmail, `%${search}%`)
        )!
      );
    }

    const result = await db
      .select({
        id: banks.id,
        name: banks.bankName,
        email: banks.contactEmail,
        activityMetric: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(banks)
      .leftJoin(users, eq(banks.userId, users.id))
      .leftJoin(transactions, and(
        eq(transactions.bankId, users.id),
        gte(transactions.createdAt, since)
      ))
      .where(and(...conditions))
      .groupBy(banks.id)
      .orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`))
      .limit(50);
    
    return result;
  }

  // RBAC
  async getPermissionsByRole(roleName: string): Promise<any[]> {
    const result = await db
      .select({
        id: permissions.id,
        name: permissions.name,
        description: permissions.description,
        createdAt: permissions.createdAt,
      })
      .from(permissions)
      .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .where(eq(roles.name, roleName));
    
    return result;
  }
}

export const storage = new DatabaseStorage();
