import "server-only";

import { startEventWorker } from "../events/event-worker";

import { recoverFailedEvents } from "./recoverFailedEvents";

// ===============================
// BOOT LOCK
// ===============================
let started = false;

// ===============================
// SAFE INTERVAL TRACKER
// ===============================
let recoveryInterval:
  | NodeJS.Timeout
  | null = null;

// ===============================
// START ALL WORKERS
// ===============================
export async function startWorkers() {
  // ===============================
  // DUPLICATE BOOT PROTECTION
  // ===============================
  if (started) {
    console.warn(
      "⚠️ Workers already running"
    );

    return;
  }

  started = true;

  console.log(
    "🚀 Starting PivotOps workers..."
  );

  try {
    // ===============================
    // START EVENT WORKER
    // ===============================
    startEventWorker().catch(
      (err: unknown) => {
        console.error(
          "🔥 Event worker crashed:",
          err
        );
      }
    );

    // ===============================
    // FAILED EVENT RECOVERY LOOP
    // ===============================
    recoveryInterval =
      setInterval(
        async () => {
          try {
            await recoverFailedEvents();
          } catch (
            err: unknown
          ) {
            console.error(
              "🔥 Recovery loop crashed:",
              err
            );
          }
        },
        60 * 1000
      );

    console.log(
      "✅ Workers started successfully"
    );
  } catch (err: unknown) {
    console.error(
      "🔥 Worker bootstrap failed:",
      err
    );

    started = false;
  }
}

// ===============================
// STOP WORKERS
// ===============================
export function stopWorkers() {
  if (recoveryInterval) {
    clearInterval(
      recoveryInterval
    );

    recoveryInterval = null;
  }

  started = false;

  console.log(
    "🛑 Workers stopped"
  );
}