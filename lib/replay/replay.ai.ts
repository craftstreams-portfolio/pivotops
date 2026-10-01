import { buildReplayTimeline } from "@/lib/replay/replay.timeline";
import { computeReplayMetrics } from "@/lib/replay/replay.metrics";
import { replayEvent } from "@/lib/replay/replay";

import type {
  ReplayTimeline,
} from "@/lib/replay/replay.timeline";

import type {
  ReplayMetrics,
} from "@/lib/replay/replay.metrics";

// ===============================
// REPORT TYPES
// ===============================
export type ReplayReport = {
  eventId: string;
  timeline: ReplayTimeline;
  metrics: ReplayMetrics;
};

export type DebugReplayResult = {
  result: unknown;
  report: ReplayReport;
};

// ===============================
// EMPTY FALLBACK HELPERS
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

function createEmptyMetrics(
  eventId: string
): ReplayMetrics {
  return {
    eventId,
    totalStages: 0,
    averageStepTimeMs: 0,
    isHealthy: false,
    failureStage: "UNKNOWN",
  };
}

// ===============================
// FULL REPLAY REPORT
// ===============================
export async function getReplayReport(
  eventId: string
): Promise<ReplayReport> {
  if (!eventId) {
    throw new Error(
      "eventId is required for replay report"
    );
  }

  try {
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

    return {
      eventId,
      timeline: createEmptyTimeline(eventId),
      metrics: createEmptyMetrics(eventId),
    };
  }
}

// ===============================
// DEBUG REPLAY
// ===============================
export async function debugReplay(
  eventId: string
): Promise<DebugReplayResult> {
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

  try {
    // ===============================
    // STEP 1: EXECUTE REPLAY
    // ===============================
    result = await replayEvent({
      eventId,
      mode: "debug",
    });

    // ===============================
    // STEP 2: GENERATE REPORT
    // ===============================
    const report =
      await getReplayReport(eventId);

    console.log(
      "✅ Debug replay completed:",
      eventId
    );

    return {
      result,
      report,
    };
  } catch (err: unknown) {
    console.error(
      "🔥 Debug replay failed:",
      err
    );

    return {
      result: null,

      report: {
        eventId,
        timeline: createEmptyTimeline(
          eventId
        ),
        metrics: createEmptyMetrics(
          eventId
        ),
      },
    };
  }
}

// ===============================
// AI REPLAY ANALYSIS
// ===============================
export async function analyzeReplay(
  eventId: string
) {
  const report =
    await getReplayReport(eventId);

  return {
    eventId,

    severity:
      report.metrics.isHealthy
        ? "low"
        : "high",

    totalStages:
      report.metrics.totalStages,

    averageStepTimeMs:
      report.metrics.averageStepTimeMs,

    durationMs:
      report.timeline.durationMs,

    success:
      report.timeline.success,

    recommendation:
      report.metrics.isHealthy
        ? "System healthy"
        : "Replay investigation recommended",
  };
}