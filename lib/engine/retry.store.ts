import { processEvent } from "../engine/workforce.engine";
import {
  getNextBatch,
  lockEvent,
  unlockEvent,
  removeEvent,
} from "../events/event.queue";

// ===============================
// WORKER LOOP
// ===============================
export async function startEventWorker() {
  console.log("⚙️ Redis Event Worker Started");

  setInterval(async () => {
    const batch = await getNextBatch(10);

    for (const event of batch) {
      await processQueueEvent(event);
    }
  }, 1000);
}

// ===============================
// PROCESS SINGLE EVENT
// ===============================
async function processQueueEvent(event: any) {
  if (!event?.id) return;

  const locked = await lockEvent(event.id);
  if (!locked) return; // another worker is handling it

  try {
    await processEvent({
      type: event.type,
      payload: event.payload,
      _queued: true,
    });

    await removeEvent(event.id);

    console.log("✅ processed:", event.id);
  } catch (err) {
    console.error("❌ worker failed:", err);

    event.attempts = (event.attempts || 0) + 1;

    if (event.attempts >= 3) {
      console.error("💀 DEAD LETTER:", event);
      await removeEvent(event.id);
    }
  } finally {
    await unlockEvent(event.id);
  }
}