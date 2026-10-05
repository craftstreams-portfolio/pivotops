import { buildGlobalFailureNetwork } from "../global/gfpn/global-failure-network.engine";
import { buildIncidentReport } from "../incidents/incident.builder";
import { recoverEvent } from "../recovery/recovery.engine";
import { predictFailure } from "../prediction/failure-predictor.engine";

// ===============================
// TYPES
// ===============================
export type RollbackAction =
  | "rollback_executed"
  | "rollback_skipped"
  | "rollback_partial";

export type RollbackResult = {
  eventId: string;
  action: RollbackAction;
  reason: string;
  restoredState?: string;
  timestamp: string;
};

// ===============================
// NORMALIZED NODE TYPE
// ===============================
type NodeLike = {
  status: "success" | "failed";
  stage: string;
};

// ===============================
// SAFE STATE RESOLVER
// ===============================
async function resolveSafeState(eventId: string): Promise<string> {
  const graph = await buildIncidentReport(eventId);

  const nodes: NodeLike[] =
    (graph as any).nodes ?? (graph as any).stages ?? [];

  const safeNode = [...nodes]
    .reverse()
    .find((n) => n.status === "success");

  return safeNode?.stage ?? "system_idle_state";
}

// ===============================
// ROLLBACK DECISION ENGINE
// ===============================
function shouldRollback(riskScore: number, failed: boolean): boolean {
  return riskScore >= 70 || failed;
}

// ===============================
// AUTONOMOUS ROLLBACK ENGINE
// ===============================
export async function executeRollback(
  eventId: string
): Promise<RollbackResult> {
  if (!eventId) throw new Error("eventId is required");

  console.log("🔁 Rollback engine triggered:", eventId);

  // ===============================
  // GLOBAL SYSTEM RISK CHECK
  // ===============================
  const global = await buildGlobalFailureNetwork([eventId]);

  const prediction = await predictFailure(eventId);

  const graph = await buildIncidentReport(eventId);

  const nodes: NodeLike[] =
    (graph as any).nodes ?? (graph as any).stages ?? [];

  const failed = nodes.some((n) => n.status === "failed");

  const riskScore = Math.max(
    global.systemRiskScore,
    prediction.failureProbability
  );

  // ===============================
  // DECISION
  // ===============================
  if (!shouldRollback(riskScore, failed)) {
    return {
      eventId,
      action: "rollback_skipped",
      reason: "System risk below rollback threshold",
      timestamp: new Date().toISOString(),
    };
  }

  // ===============================
  // SAFE STATE RESOLUTION
  // ===============================
  const safeState = await resolveSafeState(eventId);

  // ===============================
  // ATTEMPT RECOVERY FIRST
  // ===============================
  await recoverEvent(eventId);

  // ===============================
  // FINAL ROLLBACK EXECUTION
  // ===============================
  console.log(
    `🔁 Rolling back event ${eventId} to safe state: ${safeState}`
  );

  return {
    eventId,
    action: "rollback_executed",
    reason: "High system risk detected",
    restoredState: safeState,
    timestamp: new Date().toISOString(),
  };
}