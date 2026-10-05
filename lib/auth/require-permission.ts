import { hasPermission } from "./permissions";

export function requirePermission(
  role: any,
  action: string
) {
  const allowed = hasPermission(role, action);

  if (!allowed) {
    throw new Error(
      `Permission denied: ${action}`
    );
  }
}