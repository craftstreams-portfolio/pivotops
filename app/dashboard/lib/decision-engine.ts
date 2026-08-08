import { EventType } from "./event-intelligence";
import { adjustConfidence } from "./decision-memory";

// ===============================
// ACTION TYPES
// ===============================
export type SystemAction =
  | "retry_workflow"
  | "trigger_recovery"
  | "escalate_incident"
  | "monitor_only";

// ===============================
// DECISION RESULT
// ===============================
export type Decision = {
  action: SystemAction;
  confidence: number;
  reason: string;
};

// ===============================
// DECISION ENGINE (ADAPTIVE)
// ===============================
export function generateDecision(type: EventType): Decision {
  let baseDecision: Decision;

  switch (type) {
    case "workflow_failure":
      baseDecision = {
        action: "retry_workflow",
        confidence: 0.85,
        reason:
          "Workflow failure detected. System recommends immediate retry attempt.",
      };
      break;

    case "anomaly_detected":
      baseDecision = {
        action: "escalate_incident",
        confidence: 0.75,
        reason:
          "Anomaly detected. Requires human or system escalation for validation.",
      };
      break;

    case "recovery_triggered":
      baseDecision = {
        action: "trigger_recovery",
        confidence: 0.9,
        reason:
          "System already unstable. Recovery sequence should be reinforced.",
      };
      break;

    case "performance_spike":
      baseDecision = {
        action: "monitor_only",
        confidence: 0.6,
        reason:
          "Performance spike is positive. Monitoring recommended.",
      };
      break;

    default:
      baseDecision = {
        action: "monitor_only",
        confidence: 0.5,
        reason: "System stable. No intervention required.",
      };
  }

  // ===============================
  // 🧠 MEMORY-BASED LEARNING LAYER
  // ===============================
  const learnedConfidence = adjustConfidence(baseDecision.action);

  return {
    ...baseDecision,
    confidence: learnedConfidence,
  };
}