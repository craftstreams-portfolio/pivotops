import { EventType } from "./event-intelligence";

// ===============================
// INCIDENT RECORD
// ===============================
export type IncidentRecord = {
  id: string;
  type: EventType;
  message: string;
  timestamp: number;
};

// ===============================
// ROOT CAUSE RESULT
// ===============================
export type RootCauseAnalysis = {
  pattern: string;
  probableCause: string;
  severity: "low" | "medium" | "high";
};

// ===============================
// PATTERN DETECTION
// ===============================
export function detectPattern(
  incidents: IncidentRecord[]
): string {
  const failures = incidents.filter(
    (i) => i.type === "workflow_failure"
  );

  if (failures.length > 3) {
    return "repeated_workflow_failure";
  }

  const anomalies = incidents.filter(
    (i) => i.type === "anomaly_detected"
  );

  if (anomalies.length > 2) {
    return "system_instability_pattern";
  }

  return "normal_operation";
}

// ===============================
// ROOT CAUSE GENERATOR
// ===============================
export function generateRootCause(
  pattern: string
): RootCauseAnalysis {
  switch (pattern) {
    case "repeated_workflow_failure":
      return {
        pattern,
        probableCause:
          "Downstream dependency instability or misconfigured workflow pipeline.",
        severity: "high",
      };

    case "system_instability_pattern":
      return {
        pattern,
        probableCause:
          "Resource contention or overloaded execution queue.",
        severity: "medium",
      };

    default:
      return {
        pattern,
        probableCause: "No systemic issue detected.",
        severity: "low",
      };
  }
}