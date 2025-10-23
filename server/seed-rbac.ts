import { db } from "./db";
import { permissions, roles, rolePermissions } from "@shared/schema";
import { eq } from "drizzle-orm";

// Define all permissions in the system
const PERMISSIONS_DATA = [
  // User Management Permissions
  { name: "create:user:all", description: "Create any type of user account" },
  { name: "read:users:all", description: "View all user profiles" },
  { name: "read:users:customer", description: "View customer user profiles" },
  { name: "read:users:bank", description: "View bank user profiles" },
  { name: "read:users:internal", description: "View internal user profiles" },
  { name: "read:user:own", description: "View own user profile" },
  { name: "update:user:email", description: "Update user email address" },
  { name: "update:user:password", description: "Update user password" },
  { name: "update:user:role", description: "Update user role (super admin only)" },
  { name: "update:user:status", description: "Update user status (active/suspended)" },
  { name: "update:user:own", description: "Update own user profile" },
  { name: "delete:user:all", description: "Delete any user account" },
  { name: "suspend:user:all", description: "Suspend/unsuspend user accounts" },
  { name: "invite:user:all", description: "Send user invitations" },
  { name: "reset:password:all", description: "Reset password for any user" },
  { name: "reset:password:own", description: "Reset own password" },
  
  // Role & Permission Management
  { name: "read:roles:all", description: "View all roles and permissions" },
  { name: "update:role:permissions", description: "Modify role permissions" },
  
  // Dashboard & Analytics
  { name: "view:dashboard:all", description: "View all dashboard metrics" },
  { name: "view:dashboard:customer", description: "View customer dashboard" },
  { name: "view:dashboard:bank", description: "View bank dashboard" },
  { name: "view:dashboard:internal", description: "View internal dashboard" },
  
  // Claims Management
  { name: "read:claims:all", description: "View all claims" },
  { name: "read:claims:own", description: "View own claims" },
  { name: "create:claim:own", description: "Create claims" },
  { name: "update:claim:all", description: "Update any claim" },
  { name: "delete:claim:all", description: "Delete any claim" },
  
  // Revenue & Financial Data
  { name: "view:revenue:all", description: "View all revenue data" },
  { name: "view:revenue:own", description: "View own revenue data" },
  { name: "export:data:all", description: "Export system data to CSV/PDF" },
  
  // Audit Logs
  { name: "read:audit:all", description: "View all audit logs" },
  
  // System Configuration
  { name: "manage:system:config", description: "Manage system configuration" },
  { name: "manage:funding:limits", description: "Adjust claim discount limits" },
];

// Define roles with their permission assignments
const ROLES_DATA = [
  {
    name: "super_admin",
    description: "Full system access including role/permission management and system configuration",
    permissions: [
      // All user management
      "create:user:all",
      "read:users:all",
      "read:users:customer",
      "read:users:bank",
      "read:users:internal",
      "read:user:own",
      "update:user:email",
      "update:user:password",
      "update:user:role", // Only super admins can change roles
      "update:user:status",
      "update:user:own",
      "delete:user:all",
      "suspend:user:all",
      "invite:user:all",
      "reset:password:all",
      "reset:password:own",
      
      // Role management
      "read:roles:all",
      "update:role:permissions",
      
      // Full dashboard access
      "view:dashboard:all",
      "view:dashboard:customer",
      "view:dashboard:bank",
      "view:dashboard:internal",
      
      // Claims
      "read:claims:all",
      "update:claim:all",
      "delete:claim:all",
      
      // Revenue & exports
      "view:revenue:all",
      "export:data:all",
      
      // Audit logs
      "read:audit:all",
      
      // System config
      "manage:system:config",
      "manage:funding:limits",
    ],
  },
  {
    name: "admin",
    description: "Manage users and view data across all types, but cannot modify roles or system config",
    permissions: [
      // User management (except role changes)
      "create:user:all",
      "read:users:all",
      "read:users:customer",
      "read:users:bank",
      "read:users:internal",
      "read:user:own",
      "update:user:email",
      "update:user:password",
      "update:user:status",
      "update:user:own",
      "suspend:user:all",
      "invite:user:all",
      "reset:password:all",
      "reset:password:own",
      
      // View roles (but cannot modify)
      "read:roles:all",
      
      // Dashboard access
      "view:dashboard:all",
      "view:dashboard:customer",
      "view:dashboard:bank",
      "view:dashboard:internal",
      
      // Claims
      "read:claims:all",
      "update:claim:all",
      
      // Revenue & exports
      "view:revenue:all",
      "export:data:all",
      
      // Audit logs
      "read:audit:all",
    ],
  },
  {
    name: "team_member",
    description: "View-only access for monitoring and reporting",
    permissions: [
      // Read-only user access
      "read:users:all",
      "read:users:customer",
      "read:users:bank",
      "read:user:own",
      "update:user:own",
      "reset:password:own",
      
      // Dashboard viewing
      "view:dashboard:all",
      "view:dashboard:customer",
      "view:dashboard:bank",
      "view:dashboard:internal",
      
      // Claims (read-only)
      "read:claims:all",
      
      // Revenue viewing
      "view:revenue:all",
    ],
  },
];

export async function seedRBAC() {
  console.log("🌱 Seeding RBAC data...");

  try {
    // 1. Seed permissions
    console.log("  → Seeding permissions...");
    for (const perm of PERMISSIONS_DATA) {
      await db
        .insert(permissions)
        .values(perm)
        .onConflictDoUpdate({
          target: permissions.name,
          set: { description: perm.description },
        });
    }
    console.log(`  ✓ Seeded ${PERMISSIONS_DATA.length} permissions`);

    // 2. Seed roles
    console.log("  → Seeding roles...");
    for (const roleData of ROLES_DATA) {
      await db
        .insert(roles)
        .values({
          name: roleData.name,
          description: roleData.description,
        })
        .onConflictDoUpdate({
          target: roles.name,
          set: { description: roleData.description },
        });
    }
    console.log(`  ✓ Seeded ${ROLES_DATA.length} roles`);

    // 3. Assign permissions to roles
    console.log("  → Assigning permissions to roles...");
    for (const roleData of ROLES_DATA) {
      // Get role ID
      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.name, roleData.name))
        .limit(1);

      if (!role) {
        console.error(`  ✗ Role not found: ${roleData.name}`);
        continue;
      }

      // Delete existing permissions for this role (to refresh)
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id));

      // Assign new permissions
      for (const permName of roleData.permissions) {
        const [perm] = await db
          .select()
          .from(permissions)
          .where(eq(permissions.name, permName))
          .limit(1);

        if (!perm) {
          console.error(`  ✗ Permission not found: ${permName}`);
          continue;
        }

        await db.insert(rolePermissions).values({
          roleId: role.id,
          permissionId: perm.id,
        });
      }

      console.log(`  ✓ Assigned ${roleData.permissions.length} permissions to ${roleData.name}`);
    }

    console.log("✅ RBAC seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding RBAC:", error);
    throw error;
  }
}
