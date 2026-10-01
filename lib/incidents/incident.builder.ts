import { getEventTraceByEventId } from "../events/event.trace";
import { EventTrace } from "../events/event.schema";

// ===============================
// TYPES
// ===============================
export type IncidentStage = {
  eventId: string;
  stage: string;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;

  // FIX: align with EventStatus (NOT restricted subset)
  status: EventTrace["status"];
};

export type IncidentReport = {
  incidentId: string;
  eventId: string;
  stages: IncidentStage[];
  startedAt: number;
  endedAt: number;
  durationMs: number;
  failed: boolean;
  failureStage?: string;
  totalStages: number;
  summary: string;
};

// ===============================
// INCIDENT ID GENERATOR
// ===============================
function generateIncidentId(eventId: string): string {
  return `incident_${eventId}`;
}

// ===============================
// SUMMARY BUILDER
// ===============================
function buildSummary(
  failed: boolean,
  totalStages: number,
  durationMs: number
): string {
  if (failed) {
    return `Workflow failed after ${totalStages} stages in ${durationMs}ms.`;
  }

  return `Workflow completed successfully in ${durationMs}ms across ${totalStages} stages.`;
}

// ===============================
// INCIDENT BUILDER (HARDENED)
// ===============================
export async function buildIncidentReport(
  eventId: string
): Promise<IncidentReport> {
  // ===============================
  // HARD GUARD
  // ===============================
  if (!eventId) {
    throw new Error("eventId is required");
  }

  // ===============================
  // LOAD TRACES
  // ===============================
  const traces: EventTrace[] =
    await getEventTraceByEventId(eventId);

  // ===============================
  // VALIDATION
  // ===============================
  if (!traces?.length) {
    throw new Error(
      `No incident traces found for event: ${eventId}`
    );
  }

  // ===============================
  // SORT CHRONOLOGICALLY
  // ===============================
  const sorted = [...traces].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // ===============================
  // FAILURE DETECTION (STRICT)
  // ===============================
  const failed = sorted.some(
    (t) => t.status === "failed"
  );

  // ===============================
  // FAILURE STAGE
  // ===============================
  const failureStage =
    sorted.find((t) => t.status === "failed")?.stage;

  // ===============================
  // TIMELINE CALCULATION
  // ===============================
  const startedAt = sorted[0].timestamp;
  const endedAt = sorted[sorted.length - 1].timestamp;
  const durationMs = endedAt - startedAt;

  // ===============================
  // NORMALIZED STAGES
  // ===============================
  const stages: IncidentStage[] = sorted.map((t) => ({
    eventId: t.eventId,
    stage: t.stage,
    type: t.type,
    timestamp: t.timestamp,
    payload: t.payload ?? {},
    status: t.status,
  }));

  // ===============================
  // FINAL REPORT
  // ===============================
  return {
    incidentId: generateIncidentId(eventId),

    eventId,

    stages,

    startedAt,

    endedAt,

    durationMs,

    failed,

    failureStage,

    totalStages: stages.length,

    summary: buildSummary(
      failed,
      stages.length,
      durationMs
    ),
  };
}