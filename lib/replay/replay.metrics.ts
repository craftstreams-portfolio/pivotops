import { getEventTrace } from "../events/event.trace";

// ===============================
// METRICS TYPES
// ===============================
export type ReplayMetrics = {
  eventId: string;
  totalStages: number;
  averageStepTimeMs: number;
  failureStage?: string;
  isHealthy: boolean;
};

// ===============================
// SAFE NUMBER HELPER
// ===============================
function safeNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : Date.now();
}

// ===============================
// COMPUTE METRICS (HARDENED)
// ===============================
export async function computeReplayMetrics(
  eventId: string
): Promise<ReplayMetrics> {
  if (!eventId) {
    throw new Error("eventId is required for metrics computation");
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
      timestamp: safeNumber(t.timestamp),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // ===============================
  // EMPTY GUARD
  // ===============================
  if (!filtered.length) {
    throw new Error(`No metrics found for event: ${eventId}`);
  }

  const totalStages = filtered.length;

  // ===============================
  // TOTAL TIME CALCULATION (SAFE LOOP)
  // ===============================
  let totalTime = 0;

  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1].timestamp;
    const curr = filtered[i].timestamp;

    totalTime += Math.max(0, curr - prev);
  }

  const failure = filtered.find(
    (t) => t.stage === "REPLAY_FAILED"
  );

  // ===============================
  // RESULT
  // ===============================
  return {
    eventId,
    totalStages,
    averageStepTimeMs:
      totalStages > 1 ? totalTime / (totalStages - 1) : 0,
    failureStage: failure?.stage,
    isHealthy: !failure,
  };
}