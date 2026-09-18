import { emitEvent } from "../events/event-bus";

export async function updateUserRole(payload: {
  user_id: string;
  tenant_id: string;
  role: "admin" | "manager" | "employee";
}) {
  return emitEvent({
    type: "USER_ROLE_UPDATED",
    payload,
  });
}