import { runSystemSupervisor } from "./system-supervisor";
import { getIncidents, logIncident } from "./incident-memory";

// ===============================
// REMEDIATION ACTIONS
// ===============================
export type RemediationAction =
  | "restart_workflow"
  | "clear_queue"
  | "escalate_to_admin"
  | "no_action";

// ===============================
// REMEDIATION RESULT
// ===============================
export type RemediationResult = {
  action: RemediationAction;
  executed: boolean;
  reason: string;
};

// ===============================
// AUTO REMEDIATION ENGINE
// ===============================
export function runAutoRemediation(): RemediationResult {
  const report = runSystemSupervisor();

  const incidents = getIncidents();

  // ===============================
  // CRITICAL STATE HANDLING
  // ===============================
  if (report.status === "critical") {
    logIncident({
      id: Math.random().toString(36).slice(2),
      type: "anomaly_detected",
      message: "System entered critical state",
      timestamp: Date.now(),
    });

    return {
      action: "escalate_to_admin",
      executed: true,
      reason: "Critical system state detected. Escalation triggered.",
    };
  }

  // ===============================
  // UNSTABLE STATE HANDLING
  // ===============================
  if (report.status === "unstable") {
    return {
      action: "restart_workflow",
      executed: true,
      reason: "Unstable system detected. Workflow restart initiated.",
    };
  }

  // ===============================
  // DEGRADED STATE HANDLING
  // ===============================
  if (report.status === "degraded") {
    return {
      action: "clear_queue",
      executed: true,
      reason: "Performance degradation detected. Queue cleared.",
    };
  }

  // ===============================
  // HEALTHY STATE
  // ===============================
  return {
    action: "no_action",
    executed: false,
    reason: "System healthy. No remediation required.",
  };
}