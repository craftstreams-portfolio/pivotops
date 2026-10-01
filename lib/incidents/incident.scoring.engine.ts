import { IncidentGraph } from "./incident.graph.engine";

// ===============================
// TYPES
// ===============================
export type IncidentScore = {
  eventId: string;

  severityScore: number; // 0–100

  impactScore: number; // how wide failure spread

  rootCauseStrength: number; // likelihood root node caused failure

  timeToFailureMs: number;

  criticalPathLength: number;

  classification: "low" | "medium" | "high" | "critical";
};

// ===============================
// SCORING ENGINE
// ===============================
export function scoreIncident(graph: IncidentGraph): IncidentScore {
  const { nodes, failurePath, eventId } = graph;

  const totalNodes = nodes.length;

  // ===============================
  // TIME CALCULATION
  // ===============================
  const timeToFailureMs =
    failurePath.length > 0
      ? nodes.find(
          (n) => n.stage === failurePath[failurePath.length - 1]
        )?.timestamp ?? 0 - nodes[0].timestamp
      : 0;

  // ===============================
  // IMPACT SCORE (spread of failure)
  // ===============================
  const failedNodes = nodes.filter((n) => n.status === "failed");

  const impactScore =
    totalNodes === 0
      ? 0
      : Math.min(100, (failedNodes.length / totalNodes) * 100);

  // ===============================
  // ROOT CAUSE STRENGTH
  // ===============================
  const rootCauseStrength =
    failurePath.length === 0
      ? 0
      : Math.min(100, (failurePath.length / totalNodes) * 100);

  // ===============================
  // CRITICAL PATH LENGTH
  // ===============================
  const criticalPathLength = failurePath.length;

  // ===============================
  // SEVERITY SCORE (COMPOSITE MODEL)
  // ===============================
  const severityScore = Math.round(
    impactScore * 0.4 +
      rootCauseStrength * 0.4 +
      Math.min(100, criticalPathLength * 10) * 0.2
  );

  // ===============================
  // CLASSIFICATION
  // ===============================
  let classification: "low" | "medium" | "high" | "critical";

  if (severityScore >= 75) classification = "critical";
  else if (severityScore >= 50) classification = "high";
  else if (severityScore >= 25) classification = "medium";
  else classification = "low";

  return {
    eventId,
    severityScore,
    impactScore,
    rootCauseStrength,
    timeToFailureMs,
    criticalPathLength,
    classification,
  };
}