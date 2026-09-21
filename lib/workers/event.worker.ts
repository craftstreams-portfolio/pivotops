import { processEvent } from "../engine/workforce.engine";

import {
  dequeueEvent,
  lockEvent,
  unlockEvent,
  enqueueEvent,
  moveToDeadQueue,
  type QueuedEvent,
} from "../events/event.queue";

// ===============================
// WORKER SETTINGS
// ===============================
const WORKER_DELAY = 1000;
const MAX_RETRIES = 5;

// ===============================
// SAFE SLEEP
// ===============================
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ===============================
// PROCESS SINGLE EVENT
// ===============================
async function processQueueEvent(event: QueuedEvent) {
  if (!event?.id || !event?.type) return;

  const locked = await lockEvent(event.id);
  if (!locked) return;

  try {
    await processEvent({
      id: event.id,
      event_id: event.id,
      type: event.type,
      payload: event.payload ?? {},
      status: event.status ?? "queued",
    });

    console.log("✅ Event processed:", {
      id: event.id,
      type: event.type,
    });
  } catch (err: unknown) {
    console.error("🔥 Worker processing failed:", err);

    const nextAttempts = (event.attempts ?? 0) + 1;

    if (nextAttempts >= MAX_RETRIES) {
      await moveToDeadQueue({
        id: event.id,
        type: event.type,
        payload: event.payload ?? {},
        attempts: nextAttempts,
        status: "failed",
      });

      console.error("☠️ Moved to dead queue:", event.id);
    } else {
      await enqueueEvent({
        id: event.id,
        type: event.type,
        payload: event.payload ?? {},
        attempts: nextAttempts,
        status: "queued",
      });

      console.warn("🔁 Requeued event:", {
        id: event.id,
        attempts: nextAttempts,
      });
    }
  } finally {
    await unlockEvent(event.id);
  }
}

// ===============================
// QUEUE LOOP
// ===============================
async function processQueue() {
  try {
    const event = await dequeueEvent();
    if (!event) return;

    await processQueueEvent(event);
  } catch (err: unknown) {
    console.error("🔥 Queue loop crashed:", err);
  }
}

// ===============================
// WORKER START
// ===============================
export async function startEventWorker() {
  console.log("🚀 Event worker started");

  while (true) {
    await processQueue().catch((err) =>
      console.error("🔥 Worker crashed:", err)
    );

    await sleep(WORKER_DELAY);
  }
}
