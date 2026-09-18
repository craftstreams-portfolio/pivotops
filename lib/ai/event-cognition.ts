import { getEventTrace } from "../events/event.trace";

// ===============================
// TYPES
// ===============================
export type CognitionSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CognitionCategory =
  | "network"
  | "database"
  | "worker"
  | "queue"
  | "timeout"
  | "replay"
  | "unknown";

export type EventCognitionReport = {
  eventId: string;

  severity: CognitionSeverity;

  category: CognitionCategory;

  rootCause: string;

  recommendation: string;

  detectedStage?: string;

  totalStages: number;

  failed: boolean;

  analyzedAt: string;
};

// ===============================
// ROOT CAUSE DETECTOR (FIXED)
// ===============================
function detectRootCause(stages: string[]) {
  const normalized = stages.map((s) => s.toUpperCase());

  if (normalized.some((s) => s.includes("TIMEOUT"))) {
    return {
      category: "timeout" as const,
      severity: "high" as const,
      rootCause: "Workflow exceeded execution timeout.",
      recommendation: "Optimize execution or increase timeout.",
    };
  }

  if (normalized.some((s) => s.includes("REPLAY"))) {
    return {
      category: "replay" as const,
      severity: "medium" as const,
      rootCause: "Replay failure detected in recovery chain.",
      recommendation: "Inspect replay pipeline integrity.",
    };
  }

  if (
    normalized.some(
      (s) =>
        s.includes("DB") ||
        s.includes("DATABASE") ||
        s.includes("SUPABASE")
    )
  ) {
    return {
      category: "database" as const,
      severity: "critical" as const,
      rootCause: "Database operation failure detected.",
      recommendation: "Check DB queries, indexes, and latency.",
    };
  }

  if (normalized.some((s) => s.includes("QUEUE"))) {
    return {
      category: "queue" as const,
      severity: "high" as const,
      rootCause: "Queue processing instability detected.",
      recommendation: "Inspect worker backlog and throughput.",
    };
  }

  if (normalized.some((s) => s.includes("WORKER"))) {
    return {
      category: "worker" as const,
      severity: "high" as const,
      rootCause: "Worker execution failure detected.",
      recommendation: "Check worker lease and heartbeat system.",
    };
  }

  if (normalized.some((s) => s.includes("NETWORK"))) {
    return {
      category: "network" as const,
      severity: "medium" as const,
      rootCause: "Network dependency failure detected.",
      recommendation: "Retry request or validate external service.",
    };
  }

  return {
    category: "unknown" as const,
    severity: "low" as const,
    rootCause: "No structured failure pattern detected.",
    recommendation: "System appears stable.",
  };
}

// ===============================
// AI EVENT COGNITION ENGINE
// ===============================
export async function analyzeEventCognition(
  eventId: string
): Promise<EventCognitionReport> {
  if (!eventId) throw new Error("eventId is required");

  const traces = await getEventTrace(500);

  const filtered = traces.filter((t) => t.eventId === eventId);

  if (!filtered.length) {
    throw new Error(`No traces found for event: ${eventId}`);
  }

  const ordered = [...filtered].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  const stages = ordered.map((t) => t.stage);

  // ✅ FIX: use status-based failure, not string parsing
  const failed = ordered.some((t) => t.status === "failed");

  const cognition = detectRootCause(stages);

  const failedStage = ordered.find(
    (t) => t.status === "failed"
  )?.stage;

  return {
    eventId,

    severity: cognition.severity,

    category: cognition.category,

    rootCause: cognition.rootCause,

    recommendation: cognition.recommendation,

    detectedStage: failedStage,

    totalStages: ordered.length,

    failed,

    analyzedAt: new Date().toISOString(),
  };
}