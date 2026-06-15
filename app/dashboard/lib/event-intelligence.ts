export type EventType =
  | "workflow_success"
  | "workflow_failure"
  | "anomaly_detected"
  | "recovery_triggered"
  | "performance_spike";

export type RiskLevel = "low" | "medium" | "high";

export type IntelligentEvent = {
  id: string;
  type: EventType;
  message: string;
  insight: string;
  risk: RiskLevel;
  timestamp: number;
};

// ===============================
// CLASSIFIER
// ===============================
export function classifyEvent(
  message: string
): EventType {
  if (message.toLowerCase().includes("fail"))
    return "workflow_failure";

  if (message.toLowerCase().includes("recovery"))
    return "recovery_triggered";

  if (message.toLowerCase().includes("predict"))
    return "anomaly_detected";

  if (message.toLowerCase().includes("performance"))
    return "performance_spike";

  return "workflow_success";
}

// ===============================
// INSIGHT ENGINE
// ===============================
export function generateInsight(type: EventType): string {
  switch (type) {
    case "workflow_failure":
      return "A workflow interruption occurred. System may require retry or rollback.";

    case "recovery_triggered":
      return "System automatically initiated recovery sequence to stabilize execution.";

    case "anomaly_detected":
      return "Unusual pattern detected in execution flow. Monitoring recommended.";

    case "performance_spike":
      return "System performance exceeded baseline expectations.";

    default:
      return "Normal operational execution detected.";
  }
}

// ===============================
// RISK ENGINE
// ===============================
export function calculateRisk(type: EventType): RiskLevel {
  switch (type) {
    case "workflow_failure":
      return "high";

    case "anomaly_detected":
      return "medium";

    case "recovery_triggered":
      return "medium";

    case "performance_spike":
      return "low";

    default:
      return "low";
  }
}