import { processEvent } from "../engine/workforce.engine";

import {
  dequeueEvent,
  enqueueEvent,
  moveToDeadQueue,
  type QueuedEvent,
} from "../events/event.queue";

import {
  acquireLease,
  releaseLease,
  extendLease,
} from "./worker.lease";

import { WORKER_ID } from "./worker.leader";

// ===============================
// CONFIG
// ===============================
const MAX_RETRIES = 5;
const WORKER_DELAY_MS = 800;
const EXTEND_INTERVAL_MS = 5000;

// ===============================
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ===============================
// PROCESS EVENT (LEASE SAFE + HEARTBEAT SAFE)
// ===============================
async function processQueueEvent(event: QueuedEvent) {
  if (!event?.id || !event?.type) return;

  const leased = await acquireLease(event.id, WORKER_ID);
  if (!leased) return;

  let heartbeat: ReturnType<typeof setInterval> | null = null;

  try {
    // ===============================
    // HEARTBEAT LEASE EXTENSION
    // ===============================
    heartbeat = setInterval(() => {
      extendLease(event.id, WORKER_ID).catch((err) => {
        console.error("⚠️ lease extend failed:", err);
      });
    }, EXTEND_INTERVAL_MS);

    // ===============================
    // NORMALIZED ENGINE EVENT SHAPE
    // ===============================
    await processEvent({
      id: event.id,
      event_id: event.id,
      type: event.type,
      payload: event.payload ?? {},
      status: event.status ?? "queued",
    });

    console.log("✅ processed:", {
      id: event.id,
      type: event.type,
    });
  } catch (err: unknown) {
    console.error("🔥 worker processing failed:", err);

    const nextAttempts = (event.attempts ?? 0) + 1;

    // ===============================
    // DEAD LETTER QUEUE HANDLING
    // ===============================
    if (nextAttempts >= MAX_RETRIES) {
      await moveToDeadQueue({
        id: event.id,
        type: event.type,
        payload: event.payload ?? {},
        attempts: nextAttempts,
        status: "failed",
      });

      console.error("☠️ moved to dead queue:", event.id);
    } else {
      // ===============================
      // REQUEUE WITH BACKOFF
      // ===============================
      await enqueueEvent({
        id: event.id,
        type: event.type,
        payload: event.payload ?? {},
        attempts: nextAttempts,
        status: "queued",
      });

      console.warn("🔁 requeued:", {
        id: event.id,
        attempts: nextAttempts,
      });
    }
  } finally {
    // ===============================
    // CLEAN HEARTBEAT + RELEASE LEASE
    // ===============================
    if (heartbeat) clearInterval(heartbeat);
    await releaseLease(event.id);
  }
}

// ===============================
// QUEUE PROCESSOR LOOP
// ===============================
async function processQueue() {
  try {
    const event = await dequeueEvent();

    if (!event) return;

    await processQueueEvent(event);
  } catch (err: unknown) {
    console.error("🔥 queue loop error:", err);
  }
}

// ===============================
// WORKER MAIN LOOP (CRASH RESISTANT)
// ===============================
export async function startEventWorker() {
  console.log("🚀 Distributed Worker Started:", WORKER_ID);

  while (true) {
    try {
      await processQueue();
    } catch (err: unknown) {
      console.error("🔥 worker crashed:", err);
    }

    await sleep(WORKER_DELAY_MS);
  }
}