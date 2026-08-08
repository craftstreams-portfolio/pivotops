import { subscribeToWorkforceEvents } from "../../app/dashboard/lib/realtime/workforceRealtime";
import { predictOperationalRisk } from "../../app/dashboard/lib/predictive-engine/workforcePredictor";
import { runWorkforceOrchestration } from "../../app/dashboard/lib/ai/orchestrator/workforceOrchestrator";
import { executeAction } from "../../app/dashboard/lib/ai/orchestrator/remediation/workforceRemediator";
import { processEvent } from "../engine/workforce.engine";

declare global {
  // eslint-disable-next-line no-var
  var __pivotOpsWorkerRunning: boolean | undefined;
}

export function startWorker() {
  if (globalThis.__pivotOpsWorkerRunning) {
    console.warn("[PivotOpsWorker] Already running");
    return;
  }
  globalThis.__pivotOpsWorkerRunning = true;
  console.log("[PivotOpsWorker] Starting...");

  subscribeToWorkforceEvents((payload) => {
    console.log("[Worker Realtime Event]", payload);
    if (payload?.type) {
      processEvent(payload).catch((err) => {
        console.error("[Worker Engine Error]", err);
      });
    }
  });

  setInterval(async () => {
    try {
      const action = runWorkforceOrchestration();
      console.log("[Worker AI Action]", action);
      await executeAction(action);
    } catch (err) {
      console.error("[Worker Error]", err);
    }
  }, 7000);

  setInterval(() => {
    const risk = predictOperationalRisk();
    if (risk.status === "critical") {
      console.warn("[PivotOpsWorker] ALERT: Critical operational risk detected", risk);
    }
  }, 5000);

  console.log("[PivotOpsWorker] ONLINE");
}

export function stopWorker() {
  globalThis.__pivotOpsWorkerRunning = false;
  console.log("[PivotOpsWorker] Stopped");
}