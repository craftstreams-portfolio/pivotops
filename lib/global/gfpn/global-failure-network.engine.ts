import { getEventTrace } from "../../events/event.trace";
import { EventTrace } from "../../events/event.schema";
import { predictFailure } from "../../prediction/failure-predictor.engine";

// ===============================
// TYPES
// ===============================
export type GlobalFailureNode = {
  eventId: string;
  riskScore: number;
  patterns: string[];
};

export type GlobalFailureReport = {
  systemRiskScore: number;
  globalRiskLevel: "low" | "medium" | "high" | "critical";

  correlatedClusters: string[][];
  cascadingSignals: string[];

  nodes: GlobalFailureNode[];

  generatedAt: string;
};

// ===============================
// PATTERN EXTRACTOR
// ===============================
function extractGlobalPatterns(traces: EventTrace[]): string[] {
  const patterns: string[] = [];

  for (const t of traces) {
    const stage = t.stage.toUpperCase();

    if (stage.includes("TIMEOUT")) patterns.push("timeout_cluster");
    if (stage.includes("FAILED")) patterns.push("failure_cluster");
    if (stage.includes("RETRY")) patterns.push("retry_storm");
    if (stage.includes("QUEUE")) patterns.push("queue_pressure");
    if (stage.includes("DB")) patterns.push("database_latency");
  }

  return [...new Set(patterns)];
}

// ===============================
// GLOBAL RISK CLASSIFIER
// ===============================
function classifyGlobalRisk(score: number) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

// ===============================
// GFPN ENGINE
// ===============================
export async function buildGlobalFailureNetwork(
  eventIds: string[]
): Promise<GlobalFailureReport> {
  if (!eventIds?.length) {
    throw new Error("eventIds are required");
  }

  const nodes: GlobalFailureNode[] = [];

  const allTraces: EventTrace[] = await getEventTrace(2000);

  // ===============================
  // PER-EVENT ANALYSIS
  // ===============================
  for (const id of eventIds) {
    const prediction = await predictFailure(id);

    const traces = allTraces.filter((t) => t.eventId === id);

    const patterns = extractGlobalPatterns(traces);

    nodes.push({
      eventId: id,
      riskScore: prediction.failureProbability,
      patterns,
    });
  }

  // ===============================
  // GLOBAL SYSTEM RISK SCORE
  // ===============================
  const systemRiskScore =
    nodes.reduce((sum, n) => sum + n.riskScore, 0) /
    nodes.length;

  // ===============================
  // CLUSTER DETECTION
  // ===============================
  const patternMap = new Map<string, string[]>();

  for (const node of nodes) {
    for (const pattern of node.patterns) {
      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, []);
      }

      patternMap.get(pattern)!.push(node.eventId);
    }
  }

  const correlatedClusters = Array.from(patternMap.values()).filter(
    (cluster) => cluster.length > 1
  );

  // ===============================
  // CASCADING FAILURE SIGNALS
  // ===============================
  const cascadingSignals: string[] = [];

  if (patternMap.has("retry_storm")) {
    cascadingSignals.push("system_retry_overload");
  }

  if (patternMap.has("queue_pressure")) {
    cascadingSignals.push("backpressure_risk");
  }

  if (
    patternMap.has("timeout_cluster") &&
    patternMap.has("database_latency")
  ) {
    cascadingSignals.push("infra_latency_cascade");
  }

  // ===============================
  // FINAL OUTPUT
  // ===============================
  return {
    systemRiskScore: Math.round(systemRiskScore),
    globalRiskLevel: classifyGlobalRisk(systemRiskScore),

    correlatedClusters,
    cascadingSignals,

    nodes,

    generatedAt: new Date().toISOString(),
  };
}