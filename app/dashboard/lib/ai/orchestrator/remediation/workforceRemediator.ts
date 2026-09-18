import { emitEvent } from "../../../event-bus/workforceBus"
import { AIAction } from "../workforceOrchestrator";

export async function executeAction(action: AIAction) {
  switch (action.type) {
    case "SEND_ALERT":
      console.warn("AI ALERT:", action.reason);
      break;

    case "SUGGEST_STAFFING":
      console.log("AI Suggestion: Increase staffing levels");
      break;

    case "ESCALATE_INCIDENT":
      await emitEvent({
        type: "SOS_INCIDENT_CREATED",
        payload: {
          source: "AI_ORCHESTRATOR",
          severity: "auto-escalated",
        },
        timestamp: Date.now(),
      });
      break;

    case "AUTO_REASSIGN_TASKS":
      console.log("AI Reassigning workload distribution...");
      break;

    default:
      break;
  }
}