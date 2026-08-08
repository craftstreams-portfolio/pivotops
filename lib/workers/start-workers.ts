import "server-only";

import { startEventWorker } from "../events/event-worker";
import { recoverFailedEvents } from "./recoverFailedEvents";

declare global {
  // eslint-disable-next-line no-var
  var __pivotOpsWorkersStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __pivotOpsRecoveryInterval: NodeJS.Timeout | undefined;
}

export async function startWorkers() {
  if (globalThis.__pivotOpsWorkersStarted) {
    console.warn("[Workers] Already running");
    return;
  }

  globalThis.__pivotOpsWorkersStarted = true;
  console.log("[Workers] Starting PivotOps workers...");

  try {
    startEventWorker().catch((err: unknown) => {
      console.error("[Workers] Event worker crashed:", err);
    });

    globalThis.__pivotOpsRecoveryInterval = setInterval(async () => {
      try {
        await recoverFailedEvents();
      } catch (err: unknown) {
        console.error("[Workers] Recovery loop crashed:", err);
      }
    }, 60 * 1000);

    console.log("[Workers] Started successfully");
  } catch (err: unknown) {
    console.error("[Workers] Bootstrap failed:", err);
    globalThis.__pivotOpsWorkersStarted = false;
  }
}

export function stopWorkers() {
  if (globalThis.__pivotOpsRecoveryInterval) {
    clearInterval(globalThis.__pivotOpsRecoveryInterval);
    globalThis.__pivotOpsRecoveryInterval = undefined;
  }
  globalThis.__pivotOpsWorkersStarted = false;
  console.log("[Workers] Stopped");
}