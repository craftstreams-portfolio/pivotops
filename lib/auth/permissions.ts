export type UserRole =
  | "admin"
  | "manager"
  | "employee";

export function hasPermission(
  role: UserRole,
  action: string
) {
  const permissions: Record<UserRole, string[]> = {
    admin: ["*"],

    manager: [
      "view_dashboard",
      "manage_tasks",
      "manage_candidates",
      "view_clocking",
    ],

    employee: [
      "view_tasks",
      "clock_in",
      "clock_out",
    ],
  };

  if (permissions[role]?.includes("*")) {
    return true;
  }

  return permissions[role]?.includes(action);
}