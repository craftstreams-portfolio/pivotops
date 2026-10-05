import { getEventTrace } from "../events/event.trace";
import { EventTrace } from "../events/event.schema";

// ===============================
// TYPES
// ===============================
export type FailurePrediction = {
  eventId: string;

  failureProbability: number; // 0–100

  riskLevel: "low" | "medium" | "high" | "critical";

  earlySignals: string[];

  predictedFailureStage?: string;

  confidence: number;

  generatedAt: string;
};

// ===============================
// SIGNAL DETECTOR
// ===============================
function extractSignals(traces: EventTrace[]): string[] {
  const signals: string[] = [];

  for (const t of traces) {
    const stage = t.stage.toUpperCase();

    if (stage.includes("TIMEOUT")) signals.push("timeout_pressure");
    if (stage.includes("RETRY")) signals.push("retry_loop_detected");
    if (stage.includes("QUEUE")) signals.push("queue_backlog");
    if (stage.includes("DB")) signals.push("database_latency");
    if (stage.includes("FAILED")) signals.push("failure_emergence");
  }

  return [...new Set(signals)];
}

// ===============================
// FAILURE PROBABILITY MODEL (HEURISTIC V1)
// ===============================
function computeFailureProbability(signals: string[]): number {
  let score = 0;

  if (signals.includes("timeout_pressure")) score += 25;
  if (signals.includes("retry_loop_detected")) score += 20;
  if (signals.includes("queue_backlog")) score += 20;
  if (signals.includes("database_latency")) score += 25;
  if (signals.includes("failure_emergence")) score += 40;

  return Math.min(100, score);
}

// ===============================
// RISK CLASSIFIER
// ===============================
function classifyRisk(probability: number): FailurePrediction["riskLevel"] {
  if (probability >= 80) return "critical";
  if (probability >= 60) return "high";
  if (probability >= 30) return "medium";
  return "low";
}

// ===============================
// PREDICTION ENGINE
// ===============================
export async function predictFailure(
  eventId: string
): Promise<FailurePrediction> {
  if (!eventId) throw new Error("eventId is required");

  // ===============================
  // LOAD TRACE HISTORY
  // ===============================
  const traces = await getEventTrace(200);

  const filtered = traces.filter((t) => t.eventId === eventId);

  if (!filtered.length) {
    return {
      eventId,
      failureProbability: 0,
      riskLevel: "low",
      earlySignals: [],
      confidence: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  // ===============================
  // SIGNAL EXTRACTION
  // ===============================
  const signals = extractSignals(filtered);

  // ===============================
  // PROBABILITY CALCULATION
  // ===============================
  const probability = computeFailureProbability(signals);

  // ===============================
  // RISK CLASSIFICATION
  // ===============================
  const riskLevel = classifyRisk(probability);

  // ===============================
  // PREDICTED FAILURE STAGE (HEURISTIC)
  // ===============================
  const predictedFailureStage =
    filtered.find((t) => t.stage.toUpperCase().includes("TIMEOUT"))?.stage ||
    filtered.find((t) => t.stage.toUpperCase().includes("QUEUE"))?.stage ||
    undefined;

  // ===============================
  // CONFIDENCE MODEL (SIMPLE HEURISTIC)
  // ===============================
  const confidence =
    signals.length === 0
      ? 20
      : Math.min(95, signals.length * 18 + probability * 0.3);

  // ===============================
  // FINAL OUTPUT
  // ===============================
  return {
    eventId,
    failureProbability: probability,
    riskLevel,
    earlySignals: signals,
    predictedFailureStage,
    confidence: Math.round(confidence),
    generatedAt: new Date().toISOString(),
  };
}