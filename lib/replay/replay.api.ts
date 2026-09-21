import { buildReplayTimeline } from "./replay.timeline";
import type { ReplayTimeline } from "./replay.timeline";

import { computeReplayMetrics } from "./replay.metrics";
import type { ReplayMetrics } from "./replay.metrics";

import { replayEvent } from "./replay";

// ===============================
// TYPES (STRICT + ENGINE SAFE)
// ===============================
export type ReplayReport = {
  eventId: string;
  timeline: ReplayTimeline;
  metrics: ReplayMetrics | Record<string, unknown>;
};

export type DebugReplayResult = {
  result: unknown;
  report: ReplayReport;
};

// ===============================
// EMPTY FALLBACKS (SAFETY PATCH)
// ===============================
function createEmptyTimeline(
  eventId: string
): ReplayTimeline {
  return {
    eventId,
    stages: [],
    durationMs: 0,
    success: false,
  };
}

function createMetricsError(
  code: string
): Record<string, unknown> {
  return {
    error: code,
    isHealthy: false,
  };
}

// ===============================
// FULL REPLAY INSPECTION API
// ===============================
export async function getReplayReport(
  eventId: string
): Promise<ReplayReport> {
  // ===============================
  // HARD GUARD
  // ===============================
  if (!eventId) {
    throw new Error(
      "eventId is required for replay report"
    );
  }

  try {
    // ===============================
    // PARALLEL ANALYSIS
    // ===============================
    const [timeline, metrics] =
      await Promise.all([
        buildReplayTimeline(eventId),
        computeReplayMetrics(eventId),
      ]);

    return {
      eventId,
      timeline,
      metrics,
    };
  } catch (err: unknown) {
    console.error(
      "❌ Failed to build replay report:",
      err
    );

    // ===============================
    // SAFE FALLBACK RESPONSE
    // ===============================
    return {
      eventId,
      timeline: createEmptyTimeline(eventId),
      metrics: createMetricsError(
        "FAILED_TO_COMPUTE_METRICS"
      ),
    };
  }
}

// ===============================
// DEBUG REPLAY
// ===============================
export async function debugReplay(
  eventId: string
): Promise<DebugReplayResult> {
  // ===============================
  // HARD GUARD
  // ===============================
  if (!eventId) {
    throw new Error(
      "eventId is required for debug replay"
    );
  }

  console.log(
    "🧠 Debug replay started:",
    eventId
  );

  let result: unknown = null;

  let report: ReplayReport = {
    eventId,
    timeline: createEmptyTimeline(eventId),
    metrics: createMetricsError(
      "REPORT_NOT_READY"
    ),
  };

  try {
    // ===============================
    // STEP 1: RUN REPLAY ENGINE
    // ===============================
    result = await replayEvent({
      eventId,
      mode: "debug",
    });

    // ===============================
    // STEP 2: BUILD REPORT
    // ===============================
    report =
      await getReplayReport(eventId);

    console.log(
      "✅ Debug replay completed:",
      eventId
    );
  } catch (err: unknown) {
    console.error(
      "🔥 Debug replay failed:",
      err
    );

    // ===============================
    // SAFE FAILURE REPORT
    // ===============================
    report = {
      eventId,
      timeline: createEmptyTimeline(eventId),
      metrics: createMetricsError(
        "DEBUG_REPLAY_FAILED"
      ),
    };
  }

  // ===============================
  // FINAL RESPONSE
  // ===============================
  return {
    result,
    report,
  };
}