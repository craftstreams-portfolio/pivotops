import { emitEvent } from "../events/event-bus";

export async function spotlightUser(payload: {
  user_id: string;
  tenant_id: string;
  reason: string;
}) {
  return emitEvent({
    type: "USER_SPOTLIGHTED",
    payload,
  });
}