import { Request } from "express";
import { db } from "./db";
import { auditLogs, type User } from "@shared/schema";

interface AuditLogParams {
  userId: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    [key: string]: any;
  };
  req?: Request; // For capturing IP and user agent
}

/**
 * Log an audit event
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const ipAddress = params.req?.ip || params.req?.socket?.remoteAddress || null;
    const userAgent = params.req?.get('user-agent') || null;

    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      targetId: params.targetId || null,
      targetType: params.targetType || null,
      details: params.details || null,
      ipAddress,
      userAgent,
    });

    console.log(`[AUDIT] ${params.action} by user ${params.userId}${params.targetId ? ` on ${params.targetType} ${params.targetId}` : ''}`);
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - audit logging failures shouldn't break the main operation
  }
}

/**
 * Helper to log user creation
 */
export async function logUserCreated(
  actorUserId: string,
  newUser: { id: string; email: string; role: string; internalRole?: string | null },
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'create:user',
    targetId: newUser.id,
    targetType: 'user',
    details: {
      after: {
        email: newUser.email,
        role: newUser.role,
        internalRole: newUser.internalRole,
      },
    },
    req,
  });
}

/**
 * Helper to log user update
 */
export async function logUserUpdated(
  actorUserId: string,
  targetUserId: string,
  before: Record<string, any>,
  after: Record<string, any>,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'update:user',
    targetId: targetUserId,
    targetType: 'user',
    details: { before, after },
    req,
  });
}

/**
 * Helper to log password update
 */
export async function logPasswordUpdated(
  actorUserId: string,
  targetUserId: string,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'update:user:password',
    targetId: targetUserId,
    targetType: 'user',
    details: {
      message: actorUserId === targetUserId ? 'User updated own password' : 'Password reset by admin',
    },
    req,
  });
}

/**
 * Helper to log email update
 */
export async function logEmailUpdated(
  actorUserId: string,
  targetUserId: string,
  oldEmail: string,
  newEmail: string,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'update:user:email',
    targetId: targetUserId,
    targetType: 'user',
    details: {
      before: { email: oldEmail },
      after: { email: newEmail },
    },
    req,
  });
}

/**
 * Helper to log role assignment
 */
export async function logRoleAssigned(
  actorUserId: string,
  targetUserId: string,
  oldRole: string | null,
  newRole: string,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'update:user:role',
    targetId: targetUserId,
    targetType: 'user',
    details: {
      before: { internalRole: oldRole },
      after: { internalRole: newRole },
    },
    req,
  });
}

/**
 * Helper to log user status change (suspend/activate)
 */
export async function logUserStatusChanged(
  actorUserId: string,
  targetUserId: string,
  oldStatus: string,
  newStatus: string,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: newStatus === 'suspended' ? 'suspend:user' : 'activate:user',
    targetId: targetUserId,
    targetType: 'user',
    details: {
      before: { status: oldStatus },
      after: { status: newStatus },
    },
    req,
  });
}

/**
 * Helper to log user deletion
 */
export async function logUserDeleted(
  actorUserId: string,
  deletedUser: { id: string; email: string; role: string },
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'delete:user',
    targetId: deletedUser.id,
    targetType: 'user',
    details: {
      before: {
        email: deletedUser.email,
        role: deletedUser.role,
      },
    },
    req,
  });
}

/**
 * Helper to log invitation sent
 */
export async function logInvitationSent(
  actorUserId: string,
  invitationId: string,
  recipientEmail: string,
  role: string,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'invite:user',
    targetId: invitationId,
    targetType: 'invitation',
    details: {
      recipientEmail,
      role,
    },
    req,
  });
}

/**
 * Helper to log password reset request
 */
export async function logPasswordResetRequested(
  actorUserId: string,
  targetUserId: string,
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'reset:password',
    targetId: targetUserId,
    targetType: 'user',
    details: {
      message: 'Password reset link sent',
    },
    req,
  });
}

/**
 * Helper to log role permission changes (super admin only)
 */
export async function logRolePermissionsUpdated(
  actorUserId: string,
  roleId: string,
  roleName: string,
  addedPermissions: string[],
  removedPermissions: string[],
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: 'update:role:permissions',
    targetId: roleId,
    targetType: 'role',
    details: {
      roleName,
      added: addedPermissions,
      removed: removedPermissions,
    },
    req,
  });
}

/**
 * Helper to log bulk operations
 */
export async function logBulkOperation(
  actorUserId: string,
  operation: string,
  targetIds: string[],
  req?: Request
) {
  await logAudit({
    userId: actorUserId,
    action: `bulk:${operation}`,
    targetType: 'user',
    details: {
      targetIds,
      count: targetIds.length,
    },
    req,
  });
}
