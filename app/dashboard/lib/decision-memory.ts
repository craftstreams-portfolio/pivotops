import { SystemAction } from "./decision-engine";

export type DecisionRecord = {
  id: string;
  action: SystemAction;
  success: boolean;
  timestamp: number;
};

let memory: DecisionRecord[] = [];

// ===============================
// STORE DECISION RESULT
// ===============================
export function storeDecision(record: DecisionRecord) {
  memory.push(record);

  // keep memory bounded
  memory = memory.slice(-50);
}

// ===============================
// GET MEMORY
// ===============================
export function getDecisionMemory() {
  return memory;
}

// ===============================
// LEARNED CONFIDENCE ADJUSTMENT
// ===============================
export function adjustConfidence(action: SystemAction): number {
  const history = memory.filter((m) => m.action === action);

  if (history.length === 0) return 0.7;

  const successRate =
    history.filter((h) => h.success).length / history.length;

  return Math.min(0.95, Math.max(0.3, successRate));
}