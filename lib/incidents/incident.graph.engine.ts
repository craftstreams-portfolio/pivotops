import { getEventTrace } from "../events/event.trace";
import { analyzeEventCognition } from "../ai/event-cognition";
import { EventStatus } from "../events/event.schema";

// ===============================
// TYPES
// ===============================
export type IncidentNode = {
  id: string;
  stage: string;
  type: string;
  timestamp: number;
  status: "success" | "failed";
};

export type IncidentEdge = {
  from: string;
  to: string;
  reason: string;
};

export type IncidentGraph = {
  eventId: string;
  nodes: IncidentNode[];
  edges: IncidentEdge[];
  rootCauseNode?: string;
  failurePath: string[];
  generatedAt: string;
};

// ===============================
// SAFE STATUS NORMALIZER (FIXED)
// ===============================
function mapToIncidentStatus(status: EventStatus | string): "success" | "failed" {
  switch (status) {
    case "processed":
    case "queued":
    case "processing":
      return "success";

    case "failed":
      return "failed";

    case "ignored":
    case "pending":
    case "escalated":
    case "manual_review":
      return "failed";

    default:
      return "failed";
  }
}

// ===============================
// GRAPH BUILDER
// ===============================
export async function buildIncidentGraph(
  eventId: string
): Promise<IncidentGraph> {
  if (!eventId) {
    throw new Error("eventId is required");
  }

  const traces = await getEventTrace(1000);

  const filtered = traces
    .filter((t) => t.eventId === eventId)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!filtered.length) {
    throw new Error(`No traces found for event: ${eventId}`);
  }

  // ===============================
  // BUILD NODES
  // ===============================
  const nodes: IncidentNode[] = filtered.map((t, index) => ({
    id: `${eventId}-${index}`,
    stage: t.stage,
    type: t.type,
    timestamp: t.timestamp,
    status: mapToIncidentStatus(t.status as any),
  }));

  // ===============================
  // BUILD EDGES
  // ===============================
  const edges: IncidentEdge[] = [];

  for (let i = 1; i < nodes.length; i++) {
    edges.push({
      from: nodes[i - 1].id,
      to: nodes[i].id,
      reason: "sequential_execution",
    });
  }

  // ===============================
  // FAILURE NODE
  // ===============================
  const failureNode = nodes.find((n) => n.status === "failed");

  // ===============================
  // AI LAYER (kept for future scoring)
  // ===============================
  await analyzeEventCognition(eventId);

  // ===============================
  // ROOT CAUSE
  // ===============================
  const rootCauseNode =
    failureNode?.id ?? nodes[nodes.length - 1]?.id;

  // ===============================
  // FAILURE PATH
  // ===============================
  const failurePath = failureNode
    ? nodes
        .slice(0, nodes.indexOf(failureNode) + 1)
        .map((n) => n.stage)
    : [];

  return {
    eventId,
    nodes,
    edges,
    rootCauseNode,
    failurePath,
    generatedAt: new Date().toISOString(),
  };
}