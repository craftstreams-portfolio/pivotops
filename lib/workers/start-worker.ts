import { subscribeToWorkforceEvents } from "../../app/dashboard/lib/realtime/workforceRealtime";
import { predictOperationalRisk } from "../../app/dashboard/lib/predictive-engine/workforcePredictor";
import { runWorkforceOrchestration } from "../../app/dashboard/lib/ai/orchestrator/workforceOrchestrator";
import { executeAction } from "../../app/dashboard/lib/ai/orchestrator/remediation/workforceRemediator";
import { processEvent } from "../engine/workforce.engine";

/**
 * PivotOps Background Worker
 * Phase 23G Runtime Layer
 *
 * Runs independent autonomous intelligence loop
 */

let isWorkerRunning = false;

export function startWorker() {
  if (isWorkerRunning) {
    console.warn("[PivotOpsWorker] Already running");
    return;
  }

  isWorkerRunning = true;

  console.log("🧠 PivotOps Worker Starting...");

  /**
   * 1. REALTIME EVENT TAP — feeds live events into the engine
   */
  subscribeToWorkforceEvents((payload) => {
    console.log("[Worker Realtime Event]", payload);
    if (payload?.type) {
      processEvent(payload).catch((err) => {
        console.error("[Worker Engine Error]", err);
      });
    }
  });

  /**
   * 2. AI AUTONOMOUS LOOP (redundant safety brain)
   */
  setInterval(async () => {
    try {
      const action = runWorkforceOrchestration();
      console.log("[Worker AI Action]", action);
      await executeAction(action);
    } catch (err) {
      console.error("[Worker Error]", err);
    }
  }, 7000);

  /**
   * 3. RISK MONITORING LAYER
   */
  setInterval(() => {
    const risk = predictOperationalRisk();
    if (risk.status === "critical") {
      console.warn("🚨 WORKER ALERT: Critical operational risk detected", risk);
    }
  }, 5000);

  console.log("🚀 PivotOps Worker ONLINE");
}

/**
 * SAFE SHUTDOWN
 */
export function stopWorker() {
  isWorkerRunning = false;
  console.log("🛑 PivotOps Worker Stopped");
}