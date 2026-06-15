import { replayEvent } from "./event.replay";
import { getEventTrace } from "./event.logger";

// ===============================
// REPLAY FAILED EVENTS
// ===============================
export async function replayFailedEvents(limit = 10) {
  const traces = await getEventTrace();

  const failedEvents = traces
    .filter((t: any) => t.stage === "ENGINE_FAILED")
    .slice(0, limit);

  console.log(`🔁 Replaying ${failedEvents.length} failed events`);

  const results = [];

  for (const trace of failedEvents) {
    const eventId = trace?.context?.eventId;

    if (!eventId) continue;

    const result = await replayEvent({
      eventId,
      mode: "normal",
    });

    results.push({
      eventId,
      result,
    });
  }

  return results;
}