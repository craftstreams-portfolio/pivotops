import { predictFailure } from "../prediction/failure-predictor.engine";

// ===============================
// TYPES
// ===============================
export type AutoBlockDecision = {
  eventId: string;
  blocked: boolean;
  reason: string;
  riskScore: number;
};

// ===============================
// AUTO-BLOCK ENGINE
// ===============================
export async function shouldBlockEvent(
  eventId: string
): Promise<AutoBlockDecision> {
  if (!eventId) throw new Error("eventId is required");

  const prediction = await predictFailure(eventId);

  // ===============================
  // BLOCKING RULES
  // ===============================
  const shouldBlock =
    prediction.failureProbability >= 80 ||
    prediction.riskLevel === "critical";

  if (shouldBlock) {
    return {
      eventId,
      blocked: true,
      reason: "High failure probability detected",
      riskScore: prediction.failureProbability,
    };
  }

  return {
    eventId,
    blocked: false,
    reason: "System safe to execute",
    riskScore: prediction.failureProbability,
  };
}