export type Role = "admin" | "operator" | "viewer";

export type Permission =
  | "recovery:execute"
  | "rollback:execute"
  | "incident:view"
  | "system:read";

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "recovery:execute",
    "rollback:execute",
    "incident:view",
    "system:read",
  ],

  operator: ["recovery:execute", "incident:view", "system:read"],

  viewer: ["incident:view", "system:read"],
};

export function hasPermission(role: Role, permission: Permission) {
  return rolePermissions[role]?.includes(permission);
}