import { getDecisionMemory } from "./decision-memory";
import { getIncidents } from "./incident-memory";

// ===============================
// SYSTEM STATUS TYPE
// ===============================
export type SystemStatus =
  | "healthy"
  | "degraded"
  | "unstable"
  | "critical";

// ===============================
// EXECUTIVE REPORT
// ===============================
export type ExecutiveReport = {
  status: SystemStatus;
  summary: string;
  riskScore: number;
  recommendation: string;
};

// ===============================
// RISK CALCULATION
// ===============================
function calculateRiskScore(): number {
  const decisions = getDecisionMemory();
  const incidents = getIncidents();

  const failureRate =
    decisions.length === 0
      ? 0
      : decisions.filter((d) => !d.success).length /
        decisions.length;

  const incidentLoad = Math.min(1, incidents.length / 20);

  return Math.min(1, failureRate * 0.7 + incidentLoad * 0.3);
}

// ===============================
// STATUS CLASSIFIER
// ===============================
function classifyStatus(score: number): SystemStatus {
  if (score < 0.2) return "healthy";
  if (score < 0.4) return "degraded";
  if (score < 0.7) return "unstable";
  return "critical";
}

// ===============================
// EXECUTIVE SUMMARY ENGINE
// ===============================
function generateSummary(status: SystemStatus): string {
  switch (status) {
    case "healthy":
      return "System operating within optimal thresholds.";
    case "degraded":
      return "Minor inefficiencies detected across workflows.";
    case "unstable":
      return "Multiple anomalies detected. System stability reducing.";
    case "critical":
      return "Critical system stress detected. Immediate intervention recommended.";
  }
}

// ===============================
// RECOMMENDATION ENGINE
// ===============================
function generateRecommendation(status: SystemStatus): string {
  switch (status) {
    case "healthy":
      return "Continue monitoring. No action required.";
    case "degraded":
      return "Optimize workflow execution and review bottlenecks.";
    case "unstable":
      return "Investigate recurring failures and review system load.";
    case "critical":
      return "Trigger system-wide diagnostic and rollback review.";
  }
}

// ===============================
// MAIN SUPERVISOR FUNCTION
// ===============================
export function runSystemSupervisor(): ExecutiveReport {
  const riskScore = calculateRiskScore();

  const status = classifyStatus(riskScore);

  return {
    status,
    summary: generateSummary(status),
    riskScore,
    recommendation: generateRecommendation(status),
  };
}