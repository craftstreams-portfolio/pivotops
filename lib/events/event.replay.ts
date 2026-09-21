import { getEventTrace, traceEvent } from "./event.trace";
import { processEvent } from "../engine/workforce.engine";
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
// RECONSTRUCT EVENT (TRACE-SAFE)
// ===============================
async function reconstructEvent(eventId: string) {
  const traces = await getEventTrace(100);

  if (!traces.length) {
    throw new Error(`No trace found for event: ${eventId}`);
  }

  // ===============================
  // SAFE TRACE MATCH (NO .event DEPENDENCY)
  // ===============================
  const match = traces.find((t) => t.eventId === eventId);

  if (!match) {
    throw new Error(`No matching trace for event: ${eventId}`);
  }

  // ===============================
  // SAFETY PATCH (PREVENT FUTURE BREAKAGE)
  // ===============================
  const safeEvent = {
    id: match.eventId,
    event_id: match.eventId,
    type: match.type ?? "UNKNOWN_EVENT",
    payload: match.payload ?? {},
    status: "processing" as const,
  };

  return safeEvent;
}

// ===============================
// REPLAY ENGINE
// ===============================
export async function replayEvent(options: ReplayOptions) {
  const { eventId, mode = "normal", overridePayload } = options;

  try {
    console.log(`🔁 Replaying event: ${eventId} [${mode}]`);

    const event = await reconstructEvent(eventId);

    // ===============================
    // OVERRIDE PATCH (DEBUG MODE SAFE)
    // ===============================
    if (overridePayload) {
      event.payload = {
        ...event.payload,
        ...overridePayload,
      };
    }

    // ===============================
    // TRACE START
    // ===============================
    await traceEvent(event, "REPLAY_START");

    // ===============================
    // ENGINE EXECUTION
    // ===============================
    const result = await processEvent(event);

    // ===============================
    // TRACE SUCCESS
    // ===============================
    await traceEvent(event, "REPLAY_SUCCESS");

    // ===============================
    // DB STATUS UPDATE (SAFE ENUM ONLY)
    // ===============================
    await updateEventStatus(eventId, "processed");

    return result;
  } catch (err: unknown) {
    console.error("❌ Replay failed:", err);

    // ===============================
    // SAFETY PATCH (NO STRUCTURE DEPENDENCY)
    // ===============================
    await traceEvent(
      {
        id: eventId,
        type: "REPLAY_FAILED",
        payload: {},
      },
      "REPLAY_FAILED"
    );

    await updateEventStatus(eventId, "failed");

    return null;
  }
}