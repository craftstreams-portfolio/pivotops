import { getEventTrace } from "../events/event.trace";

// ===============================
// TYPES
// ===============================
export type ReplayStreamEvent = {
  eventId: string;
  stage: string;
  type: string;
  timestamp: number;
  payload: any;
};

// ===============================
// LIVE STREAM GENERATOR
// ===============================
export async function* streamReplay(eventId: string) {
  const traces = await getEventTrace(1000);

  const filtered = traces
    .filter((t) => t.eventId === eventId)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!filtered.length) {
    throw new Error(`No replay stream found for event: ${eventId}`);
  }

  for (const trace of filtered) {
    yield {
      eventId: trace.eventId,
      stage: trace.stage,
      type: trace.type,
      timestamp: trace.timestamp,
      payload: trace.payload,
    };

    // simulate real-time playback delay
    await new Promise((r) => setTimeout(r, 400));
  }
}