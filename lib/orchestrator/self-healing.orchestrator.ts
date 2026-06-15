import { buildIncidentGraph } from "../incidents/incident.graph.engine";
import { scoreIncident } from "../incidents/incident.scoring.engine";
import { recoverEvent } from "../recovery/recovery.engine";

// ===============================
// TYPES
// ===============================
export type SystemHealth = {
  systemScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  activeIncidents: number;
  recommendations: string[];
};

export type OrchestratorResult = {
  eventId: string;
  action: "none" | "monitor" | "heal" | "rollback";
  reason: string;
  health: SystemHealth;
  timestamp: string;
};

// ===============================
// SYSTEM HEALTH CALCULATOR
// ===============================
function computeSystemHealth(scores: number[]): SystemHealth {
  const avg =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

  let riskLevel: SystemHealth["riskLevel"] = "low";

  if (avg >= 80) riskLevel = "critical";
  else if (avg >= 60) riskLevel = "high";
  else if (avg >= 30) riskLevel = "medium";

  return {
    systemScore: Math.round(avg),
    riskLevel,
    activeIncidents: scores.length,
    recommendations:
      avg >= 60
        ? ["Investigate failing services", "Enable auto-healing"]
        : ["System stable"],
  };
}

// ===============================
// ORCHESTRATOR CORE
// ===============================
export async function runSelfHealingOrchestrator(
  eventId: string,
  recentEventIds: string[] = []
): Promise<OrchestratorResult> {
  if (!eventId) throw new Error("eventId is required");

  // ===============================
  // CURRENT INCIDENT ANALYSIS
  // ===============================
  const graph = await buildIncidentGraph(eventId);
  const score = scoreIncident(graph);

  // ===============================
  // CROSS INCIDENT CORRELATION
  // ===============================
  const relatedScores: number[] = [];

  for (const id of recentEventIds) {
    const g = await buildIncidentGraph(id);
    const s = scoreIncident(g);
    relatedScores.push(s.severityScore);
  }

  const systemHealth = computeSystemHealth(relatedScores);

  // ===============================
  // DECISION ENGINE (ORCHESTRATOR BRAIN)
  // ===============================
  let action: OrchestratorResult["action"] = "none";
  let reason = "System stable";

  // 🔥 CRITICAL SYSTEM STATE
  if (systemHealth.riskLevel === "critical" || score.severityScore >= 85) {
    action = "heal";
    reason = "Critical instability detected";

    await recoverEvent(eventId);
  }

  // ⚠️ HIGH RISK STATE
  else if (systemHealth.riskLevel === "high" || score.severityScore >= 65) {
    action = "monitor";
    reason = "System under stress - monitoring enabled";
  }

  // 🧯 EXTREME CASE: rollback trigger
  if (score.severityScore >= 95) {
    action = "rollback";
    reason = "Severe failure detected - rollback recommended";
  }

  // ===============================
  // RETURN ORCHESTRATOR RESULT
  // ===============================
  return {
    eventId,
    action,
    reason,
    health: systemHealth,
    timestamp: new Date().toISOString(),
  };
}