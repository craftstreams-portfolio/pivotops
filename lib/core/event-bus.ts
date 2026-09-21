import { saveEvent } from "../events/event-store";

// ===============================
// EVENT EMITTER (FINAL CONTRACT)
// ===============================
export async function emitCandidateEvent(event: {
  type: string;
  payload: any;
}) {
  if (!event?.type || !event?.payload?.candidate_id) {
    console.error("❌ Invalid event blocked:", event);
    return null;
  }

  const enrichedPayload = {
    ...event.payload,
    event_id: `${event.type}-${event.payload.candidate_id}-${Date.now()}`,
  };

  const result = await saveEvent({
    type: event.type,
    payload: enrichedPayload,
    status: "queued",
    idempotency_key: enrichedPayload.event_id,
  });

  return result;
}