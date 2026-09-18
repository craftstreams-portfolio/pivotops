import { supabase } from "../supabase";

// ===============================
// ROLE TYPE (INLINE FIX - NO IMPORTS)
// ===============================
export type Role =
  | "admin"
  | "recruiter"
  | "manager"
  | "employee"
  | "viewer";

// ===============================
// GET USER ROLE
// ===============================
export async function getUserRole(userId: string, tenant_id: string): Promise<Role> {
  if (!userId || !tenant_id) return "viewer";

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenant_id)
    .single();

  if (error || !data?.role) return "viewer";

  return data.role as Role;
}

// ===============================
// PERMISSION MATRIX
// ===============================
const permissions: Record<Role, string[]> = {
  admin: ["*"],

  manager: [
    "recruitment:read",
    "recruitment:update",
    "tasks:*",
    "clocking:read",
    "analytics:read",
    "spotlight:read",
  ],

  recruiter: [
    "recruitment:*",
    "tasks:read",
    "analytics:read",
    "spotlight:read",
  ],

  employee: [
    "tasks:read",
    "tasks:update",
    "clocking:*",
    "spotlight:read",
  ],

  viewer: [
    "analytics:read",
    "spotlight:read",
  ],
};

// ===============================
// CHECK PERMISSION
// ===============================
export function hasPermission(role: Role, action: string): boolean {
  const allowed = permissions[role] || [];

  if (allowed.includes("*")) return true;

  return allowed.some((perm) => {
    // exact match
    if (perm === action) return true;

    // wildcard match (e.g. tasks:*)
    if (perm.endsWith(":*")) {
      const prefix = perm.split(":")[0];
      return action.startsWith(prefix + ":");
    }

    return false;
  });
}

// ===============================
// ASSERT PERMISSION (HARD BLOCK)
// ===============================
export function assertPermission(role: Role, action: string) {
  if (!hasPermission(role, action)) {
    throw new Error(`RBAC BLOCKED: ${role} cannot perform ${action}`);
  }
}

// ===============================
// RBAC WRAPPER (SAFE EXECUTION)
// ===============================
export async function withRBAC<T>(
  userId: string,
  tenant_id: string,
  action: string,
  callback: () => Promise<T>
): Promise<T | null> {
  const role = await getUserRole(userId, tenant_id);

  if (!hasPermission(role, action)) {
    console.warn(`[RBAC BLOCKED] ${role} tried ${action}`);
    return null;
  }

  return await callback();
}

// ===============================
// FRONTEND SAFE CHECK
// ===============================
export function can(role: Role, action: string): boolean {
  return hasPermission(role, action);
}