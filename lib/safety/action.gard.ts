import { Role, hasPermission } from "../auth/rbac";

export function guardAction(
  role: Role,
  permission: "recovery:execute" | "rollback:execute"
) {
  if (!hasPermission(role, permission)) {
    throw new Error(
      `ACCESS_DENIED: Role ${role} cannot perform ${permission}`
    );
  }
}