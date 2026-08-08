import { dequeueEvent } from "../events/event.queue";
import { processEvent } from "./workforce.engine";
import { updateEventStatus } from "../events/event-store";

// ===============================
// CONFIG
// ===============================
const MAX_RETRIES = 3;

// ===============================
// WORKER LOOP
// ===============================
export function startEventWorker() {
  console.log("🚀 Worker started");

  setInterval(async () => {
    await runWorkerCycle();
  }, 2000); // every 2 seconds
}

// ===============================
// WORKER CYCLE
// ===============================
async function runWorkerCycle() {
  const event = await dequeueEvent();

  if (!event) return;

  try {
    await processEvent(event);

    if (event.id) {
      await updateEventStatus(event.id, "processed");
    }
  } catch (err) {
    console.error("🔥 Worker failed:", err);

    await handleRetry(event);
  }
}

// ===============================
// RETRY LOGIC
// ===============================
async function handleRetry(event: any) {
  const retries = event.retries || 0;

  if (retries >= MAX_RETRIES) {
    console.error("💀 DEAD LETTER EVENT:", event.id);

    if (event.id) {
      await updateEventStatus(event.id, "failed");
    }

    return;
  }

  const updated = {
    ...event,
    retries: retries + 1,
    next_retry_at: Date.now() + retries * 5000,
  };

  // requeue event (back to queue)
  const { getRedis } = await import("../redis/client");
  const redis = await getRedis();
  if (!redis) return;               // no queue configured - drop the retry

  await redis.lPush("pivotops:event:queue", JSON.stringify(updated));
}