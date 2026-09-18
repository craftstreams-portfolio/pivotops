import { getEventTrace } from "../events/event.trace";
import { predictFailure } from "../prediction/failure-predictor.engine";

// ===============================
// TYPES
// ===============================
export type RiskHeatNode = {
  eventId: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
};

export type RiskHeatmap = {
  nodes: RiskHeatNode[];
  systemRiskScore: number;
  generatedAt: string;
};

// ===============================
// HEATMAP ENGINE
// ===============================
export async function buildRiskHeatmap(
  eventIds: string[]
): Promise<RiskHeatmap> {
  if (!eventIds?.length) {
    throw new Error("eventIds required");
  }

  const nodes: RiskHeatNode[] = [];

  for (const id of eventIds) {
    const prediction = await predictFailure(id);

    nodes.push({
      eventId: id,
      riskScore: prediction.failureProbability,
      riskLevel: prediction.riskLevel,
    });
  }

  const systemRiskScore =
    nodes.reduce((acc, n) => acc + n.riskScore, 0) /
    nodes.length;

  return {
    nodes,
    systemRiskScore: Math.round(systemRiskScore),
    generatedAt: new Date().toISOString(),
  };
}