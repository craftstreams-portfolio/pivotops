import { getEventTrace } from "../events/event.trace";

// ===============================
// TYPES
// ===============================
export type TimelineStage = {
  eventId: string;
  stage: string;
  type: string;
  timestamp: number;
  payload: any;
};

export type ReplayTimeline = {
  eventId: string;
  stages: TimelineStage[];
  durationMs: number;
  success: boolean;
};

// ===============================
// SAFE NUMBER HELPER (PREVENT NaN BREAKS)
// ===============================
function safeNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : Date.now();
}

// ===============================
// BUILD TIMELINE (HARDENED)
// ===============================
export async function buildReplayTimeline(
  eventId: string
): Promise<ReplayTimeline> {
  if (!eventId) {
    throw new Error("eventId is required for timeline build");
  }

  const traces = await getEventTrace(500);

  // ===============================
  // SAFE FILTER + NORMALIZATION
  // ===============================
  const filtered = traces
    .filter((t: any) => t?.eventId === eventId)
    .map((t: any) => ({
      eventId: t.eventId,
      stage: t.stage ?? "UNKNOWN",
      type: t.type ?? "unknown",
      timestamp: safeNumber(t.timestamp),
      payload: t.payload ?? {},
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // ===============================
  // EMPTY SAFETY GUARD
  // ===============================
  if (!filtered.length) {
    throw new Error(`No timeline found for event: ${eventId}`);
  }

  // ===============================
  // DURATION CALCULATION (SAFE)
  // ===============================
  const start = filtered[0].timestamp;
  const end = filtered[filtered.length - 1].timestamp;

  return {
    eventId,
    stages: filtered,
    durationMs: Math.max(0, end - start),
    success: !filtered.some((t) => t.stage === "REPLAY_FAILED"),
  };
}