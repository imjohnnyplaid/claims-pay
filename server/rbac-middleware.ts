import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { permissions, roles, rolePermissions, users } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import type { User } from "@shared/schema";

// Cache for role permissions (simple in-memory cache)
const rolePermissionsCache = new Map<string, string[]>();

/**
 * Get all permissions for a given role
 */
export async function getRolePermissions(roleName: string): Promise<string[]> {
  // Check cache first
  if (rolePermissionsCache.has(roleName)) {
    return rolePermissionsCache.get(roleName)!;
  }

  try {
    // Find role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      return [];
    }

    // Get all permission IDs for this role
    const rolePerms = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));

    if (rolePerms.length === 0) {
      rolePermissionsCache.set(roleName, []);
      return [];
    }

    // Get permission details
    const permIds = rolePerms.map(rp => rp.permissionId);
    const perms = await db
      .select()
      .from(permissions)
      .where(inArray(permissions.id, permIds));

    const permNames = perms.map(p => p.name);
    
    // Cache the result
    rolePermissionsCache.set(roleName, permNames);
    
    return permNames;
  } catch (error) {
    console.error(`Error getting role permissions for ${roleName}:`, error);
    return [];
  }
}

/**
 * Get all permissions for a user based on their role and internalRole
 */
export async function getUserPermissions(user: User): Promise<string[]> {
  // For internal users (admin role), use their internalRole permissions
  if (user.role === "admin" && user.internalRole) {
    return await getRolePermissions(user.internalRole);
  }

  // For provider and bank users, they don't have explicit RBAC permissions
  // They can only access their own resources
  if (user.role === "provider") {
    return [
      "read:user:own",
      "update:user:own",
      "reset:password:own",
      "read:claims:own",
      "create:claim:own",
      "view:revenue:own",
      "view:dashboard:customer",
    ];
  }

  if (user.role === "bank") {
    return [
      "read:user:own",
      "update:user:own",
      "reset:password:own",
      "view:dashboard:bank",
    ];
  }

  return [];
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(user: User, permission: string): Promise<boolean> {
  const userPermissions = await getUserPermissions(user);
  return userPermissions.includes(permission);
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function hasAnyPermission(user: User, permissions: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(user);
  return permissions.some(perm => userPermissions.includes(perm));
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function hasAllPermissions(user: User, permissions: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(user);
  return permissions.every(perm => userPermissions.includes(perm));
}

/**
 * Middleware to require specific permission(s)
 * Usage: app.get('/api/users', requirePermission('read:users:all'), handler)
 */
export function requirePermission(permission: string | string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = await hasAnyPermission(user, permissions);

    if (!hasAccess) {
      return res.status(403).json({
        message: "Insufficient permissions",
        required: permissions,
        hint: user.role === "admin" && !user.internalRole
          ? "Please contact a super admin to assign you an internal role"
          : undefined,
      });
    }

    next();
  };
}

/**
 * Middleware to require ALL specified permissions
 */
export function requireAllPermissions(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const hasAccess = await hasAllPermissions(user, permissions);

    if (!hasAccess) {
      return res.status(403).json({
        message: "Insufficient permissions",
        required: permissions,
        hint: user.role === "admin" && !user.internalRole
          ? "Please contact a super admin to assign you an internal role"
          : undefined,
      });
    }

    next();
  };
}

/**
 * Middleware to require super admin role
 */
export function requireSuperAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role !== "admin" || user.internalRole !== "super_admin") {
      return res.status(403).json({
        message: "Super admin access required",
        hint: "Only super admins can perform this action",
      });
    }

    next();
  };
}

/**
 * Middleware to require admin or super admin role
 */
export function requireAdminOrSuperAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User | undefined;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role !== "admin" || !user.internalRole || !["admin", "super_admin"].includes(user.internalRole)) {
      return res.status(403).json({
        message: "Admin access required",
        hint: "Only admins and super admins can perform this action",
      });
    }

    next();
  };
}

/**
 * Clear permissions cache (call this when roles/permissions are updated)
 */
export function clearPermissionsCache() {
  rolePermissionsCache.clear();
}
