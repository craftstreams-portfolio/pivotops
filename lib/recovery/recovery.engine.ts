import { replayEvent } from "../replay/replay";
import { analyzeEventCognition } from "../ai/event-cognition";
import { updateEventStatus } from "../events/event-store";

// ===============================
// TYPES
// ===============================
export type RecoveryAction =
  | "retry"
  | "ignore"
  | "escalate"
  | "manual_review";

export type RecoveryResult = {
  eventId: string;
  success: boolean;
  action: RecoveryAction;
  reason: string;
  recoveredAt?: string;
};

// ===============================
// NORMALIZED AI TYPE (SAFE BOUNDARY)
// ===============================
type Cognition = {
  severity: "low" | "medium" | "high" | "critical";
  category: "worker" | "queue" | "database" | "timeout" | "unknown";
};

// ===============================
// SAFE NORMALIZER (FIXES ALL TS ISSUES)
// ===============================
function normalizeCognition(raw: any): Cognition {
  return {
    severity: raw?.severity ?? "low",
    category: raw?.category ?? "unknown",
  };
}

// ===============================
// DECISION ENGINE
// ===============================
function decideRecoveryAction(
  severity: Cognition["severity"],
  category: Cognition["category"]
): RecoveryAction {
  if (severity === "critical" && category === "database") return "escalate";
  if (category === "worker" || category === "queue") return "retry";
  if (category === "timeout") return "retry";
  if (category === "unknown") return "manual_review";
  return "ignore";
}

// ===============================
// STATUS MAPPER (FIXED)
// ===============================
function mapStatus(action: RecoveryAction) {
  switch (action) {
    case "retry":
      return "pending";
    case "ignore":
      return "ignored";
    case "escalate":
      return "escalated";
    case "manual_review":
      return "manual_review";
    default:
      return "pending";
  }
}

// ===============================
// ENGINE
// ===============================
export async function recoverEvent(
  eventId: string
): Promise<RecoveryResult> {
  if (!eventId) throw new Error("eventId is required");

  try {
    console.log("🛠 Recovery engine started:", eventId);

    // ===============================
    // AI LAYER (SAFE BOUNDARY)
    // ===============================
    const raw = await analyzeEventCognition(eventId);

    const cognition = normalizeCognition(raw);

    // ===============================
    // DECISION
    // ===============================
    const action = decideRecoveryAction(
      cognition.severity,
      cognition.category
    );

    // ===============================
    // EXECUTION
    // ===============================
    if (action === "retry") {
      await replayEvent({ eventId, mode: "normal" });
    }

    // ===============================
    // STATUS UPDATE (TYPE SAFE)
    // ===============================
    await updateEventStatus(
      eventId,
      mapStatus(action)
    );

    return {
      eventId,
      success: action !== "manual_review",
      action,
      reason: "Recovery processed successfully",
      recoveredAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    await updateEventStatus(eventId, "pending");

    return {
      eventId,
      success: false,
      action: "manual_review",
      reason: err instanceof Error ? err.message : "RECOVERY_FAILED",
    };
  }
}