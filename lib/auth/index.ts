export type UserRole = "admin" | "manager" | "operator" | "employee" | "viewer";

export type Permission =
  | "recovery:execute"
  | "rollback:execute"
  | "incident:view"
  | "incident:manage"
  | "system:read"
  | "system:manage"
  | "view_dashboard"
  | "manage_tasks"
  | "manage_candidates"
  | "view_clocking"
  | "view_tasks"
  | "clock_in"
  | "clock_out"
  | "*";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ["*"],
  manager: [
    "view_dashboard",
    "manage_tasks",
    "manage_candidates",
    "view_clocking",
    "incident:view",
    "incident:manage",
    "system:read",
  ],
  operator: [
    "recovery:execute",
    "incident:view",
    "system:read",
    "view_dashboard",
  ],
  employee: [
    "view_tasks",
    "clock_in",
    "clock_out",
    "incident:view",
  ],
  viewer: [
    "incident:view",
    "system:read",
    "view_dashboard",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const perms = rolePermissions[role] ?? [];
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}