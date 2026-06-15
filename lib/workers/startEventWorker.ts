import { processEvent } from "../engine/workforce.engine";
import { dequeueEvent } from "../realtime/event.queue";

let running = false;

// ===============================
// WORKER LOOP
// ===============================
export function startEventWorker() {
  if (running) return;

  running = true;

  console.log("🚀 Event worker started...");

  const loop = async () => {
    try {
      const event = await dequeueEvent();

      if (event) {
        await processEvent(event);
      }
    } catch (err) {
      console.error("❌ Worker loop error:", err);
    }

    setTimeout(loop, 500); // safe interval polling
  };

  loop();
}