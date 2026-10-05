import { getLedgerEvents } from "../../event-bus/workforceLedger";
import { predictOperationalRisk } from "../../predictive-engine/workforcePredictor";

export type ActionType =
  | "SEND_ALERT"
  | "SUGGEST_STAFFING"
  | "ESCALATE_INCIDENT"
  | "AUTO_REASSIGN_TASKS"
  | "NO_ACTION";

export interface AIAction {
  type: ActionType;
  confidence: number;
  reason: string;
}

export function runWorkforceOrchestration(): AIAction {
  const events = getLedgerEvents();
  const risk = predictOperationalRisk();

  const recentSOS = events.filter(
    (e) => e.type === "SOS_INCIDENT_CREATED"
  ).length;

  const clockInstability =
    events.filter((e) => e.type === "CLOCK_OUT").length >
    events.filter((e) => e.type === "CLOCK_IN").length;

  if (risk.status === "critical") {
    return {
      type: "ESCALATE_INCIDENT",
      confidence: 0.92,
      reason: "Critical operational instability detected",
    };
  }

  if (recentSOS > 3) {
    return {
      type: "SUGGEST_STAFFING",
      confidence: 0.85,
      reason: "High SOS frequency requires staffing reinforcement",
    };
  }

  if (clockInstability) {
    return {
      type: "AUTO_REASSIGN_TASKS",
      confidence: 0.78,
      reason: "Shift imbalance detected between clock-ins/outs",
    };
  }

  if (risk.status === "high") {
    return {
      type: "SEND_ALERT",
      confidence: 0.7,
      reason: "Operational pressure increasing",
    };
  }

  return {
    type: "NO_ACTION",
    confidence: 0.95,
    reason: "System operating within normal bounds",
  };
}
