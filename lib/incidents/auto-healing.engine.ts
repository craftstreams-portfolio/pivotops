import { scoreIncident } from "./incident.scoring.engine";
import { buildIncidentGraph } from "./incident.graph.engine";
import { recoverEvent } from "../recovery/recovery.engine";

// ===============================
// AUTO HEALING ENGINE
// ===============================
export async function autoHeal(eventId: string) {
  if (!eventId) throw new Error("eventId required");

  const graph = await buildIncidentGraph(eventId);

  const score = scoreIncident(graph);

  // ===============================
  // HEALING THRESHOLD LOGIC
  // ===============================
  if (score.severityScore >= 85) {
    console.log("🔥 Critical auto-heal triggered:", eventId);

    return await recoverEvent(eventId);
  }

  if (score.severityScore >= 60) {
    console.log("⚠️ High severity detected (monitor mode):", eventId);

    return {
      eventId,
      action: "monitor",
      reason: "Below auto-heal threshold",
    };
  }

  return {
    eventId,
    action: "ignore",
    reason: "System stable",
  };
}