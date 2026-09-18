import { RemediationAction } from "./auto-remediation";

// ===============================
// SAFE EXECUTOR
// ===============================
export function executeSafely(action: RemediationAction) {
  const protectedActions: RemediationAction[] = [
    "escalate_to_admin",
  ];

  // ===============================
  // BLOCK UNSAFE AUTOMATION
  // ===============================
  if (protectedActions.includes(action)) {
    console.warn("⚠️ Action requires manual approval:", action);

    return {
      executed: false,
      reason: "Manual approval required",
    };
  }

  // ===============================
  // SIMULATED EXECUTION LAYER
  // ===============================
  switch (action) {
    case "restart_workflow":
      return {
        executed: true,
        reason: "Workflow restarted successfully",
      };

    case "clear_queue":
      return {
        executed: true,
        reason: "Queue cleared successfully",
      };

    default:
      return {
        executed: false,
        reason: "No operation performed",
      };
  }
}