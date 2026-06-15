import { runWorkforceOrchestration } from "../workforceOrchestrator";;
import { executeAction } from "../remediation/workforceRemediator";

export function startControlLoop() {
  setInterval(async () => {
    const action = runWorkforceOrchestration();

    console.log("[AI CONTROL LOOP]", action);

    await executeAction(action);
  }, 5000);
}