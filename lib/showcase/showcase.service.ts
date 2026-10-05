import { emitEvent } from "../events/event-bus";

export async function createShowcase(payload: {
  tenant_id: string;
  title: string;
  description?: string;
}) {
  return emitEvent({
    type: "SHOWCASE_CREATED",
    payload,
  });
}