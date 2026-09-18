import { runAutoRemediation } from "./auto-remediation";
import { executeSafely } from "./safe-executor";

// ===============================
// AUTONOMY ORCHESTRATOR
// ===============================
export function runAutonomousSystem() {
  const remediation = runAutoRemediation();

  const execution = executeSafely(remediation.action);

  return {
    remediation,
    execution,
    systemStatus: "autonomous_cycle_complete",
  };
}