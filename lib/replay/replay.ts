import { processEvent } from "../engine/workforce.engine";
import { getEventTrace, traceEvent } from "../events/event.trace";
import { updateEventStatus } from "../events/event-store";

// ===============================
// TYPES
// ===============================
export type ReplayOptions = {
  eventId: string;
  mode?: "normal" | "debug";
  overridePayload?: any;
};

// ===============================
// REPLAY CORE ENGINE
// ===============================
export async function replayEvent(options: ReplayOptions) {
  const { eventId, overridePayload } = options;

  const traces = await getEventTrace(200);

  const match = traces.find((t) => t.eventId === eventId);

  if (!match) {
    throw new Error(`No trace found for event: ${eventId}`);
  }

  const event = {
    id: match.eventId,
    event_id: match.eventId,
    type: match.type,
    payload: overridePayload ?? match.payload ?? {},
    status: "processing" as const,
  };

  await traceEvent(event, "REPLAY_START");

  try {
    const result = await processEvent(event);

    await traceEvent(event, "REPLAY_SUCCESS");

    await updateEventStatus(eventId, "processed");

    return result;
  } catch (err) {
    await traceEvent(event, "REPLAY_FAILED");

    await updateEventStatus(eventId, "failed");

    return null;
  }
}