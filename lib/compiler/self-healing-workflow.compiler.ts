import { buildIncidentReport } from "../incidents/incident.builder";
import { buildGlobalFailureNetwork } from "../global/gfpn/global-failure-network.engine";
import { predictFailure } from "../prediction/failure-predictor.engine";

// ===============================
// TYPES
// ===============================
export type WorkflowPatch = {
  originalEventId: string;
  improvedStrategy: string;
  removedStages: string[];
  addedSafeguards: string[];
  riskReductionScore: number;
  generatedAt: string;
};

type NodeLike = {
  stage: string;
  status: "success" | "failed";
};

// ===============================
// PATTERN DETECTOR
// ===============================
function detectWeakPoints(nodes: NodeLike[]) {
  const weakStages: string[] = [];
  const safeguards: string[] = [];

  for (const n of nodes) {
    if (n.stage.toLowerCase().includes("timeout")) {
      weakStages.push(n.stage);
      safeguards.push("increase_timeout_threshold");
    }

    if (n.stage.toLowerCase().includes("retry")) {
      weakStages.push(n.stage);
      safeguards.push("add_retry_backoff_strategy");
    }

    if (n.status === "failed") {
      weakStages.push(n.stage);
      safeguards.push("add_pre_execution_validation");
    }
  }

  return {
    weakStages: [...new Set(weakStages)],
    safeguards: [...new Set(safeguards)],
  };
}

// ===============================
// STRATEGY GENERATOR
// ===============================
function generateStrategy(safeguards: string[]): string {
  if (safeguards.length === 0) {
    return "standard_execution_pipeline";
  }

  if (safeguards.includes("add_pre_execution_validation")) {
    return "validated_execution_pipeline";
  }

  if (safeguards.includes("add_retry_backoff_strategy")) {
    return "resilient_execution_pipeline";
  }

  return "hardened_execution_pipeline";
}

// ===============================
// SELF-HEALING COMPILER
// ===============================
export async function compileSelfHealingWorkflow(
  eventId: string
): Promise<WorkflowPatch> {
  if (!eventId) throw new Error("eventId is required");

  // ===============================
  // LOAD INCIDENT + GLOBAL CONTEXT
  // ===============================
  const incident = await buildIncidentReport(eventId);
  const global = await buildGlobalFailureNetwork([eventId]);
  const prediction = await predictFailure(eventId);

  // ===============================
  // NORMALIZE NODES
  // ===============================
  const nodes: NodeLike[] = (incident as any).nodes ?? (incident as any).stages ?? [];

  // ===============================
  // ANALYZE WEAK POINTS
  // ===============================
  const analysis = detectWeakPoints(nodes);

  // ===============================
  // STRATEGY SELECTION
  // ===============================
  const strategy = generateStrategy(analysis.safeguards);

  // ===============================
  // RISK CALCULATION
  // ===============================
  const riskReductionScore = Math.max(
    0,
    100 - prediction.failureProbability
  );

  // ===============================
  // FINAL PATCH OUTPUT
  // ===============================
  return {
    originalEventId: eventId,
    improvedStrategy: strategy,
    removedStages: analysis.weakStages,
    addedSafeguards: analysis.safeguards,
    riskReductionScore: Math.round(riskReductionScore),
    generatedAt: new Date().toISOString(),
  };
}