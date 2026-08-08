import { emitEvent } from "../events/event-bus";

export async function updateSettings(payload: {
  tenant_id: string;
  user_id?: string;
  settings: Record<string, any>;
}) {
  return emitEvent({
    type: "SETTINGS_UPDATED",
    payload,
  });
}