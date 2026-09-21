import { dequeueEvent } from "./event.queue";
import { processEvent } from "../engine/workforce.engine";

// ===============================
// REDIS WORKER LOOP
// ===============================
export async function startRedisWorker() {
  console.log("⚙️ Redis worker started");

  while (true) {
    try {
      const job = await dequeueEvent();

      if (!job) {
        await sleep(500); // prevent CPU spam
        continue;
      }

      await processEvent({
        type: job.type,
        payload: job.payload,
        _queued: true,
      });

      console.log("✅ processed job:", job.id);
    } catch (err) {
      console.error("❌ worker error:", err);
    }
  }
}

// ===============================
// SAFE SLEEP UTILITY
// ===============================
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}