import { redis } from "../redis/client";

const CHANNEL = "pivotops:realtime";

// ===============================
// PUBLISH EVENT
// ===============================
export async function publishRealtimeEvent(
  event: any
) {
  await redis.publish(
    CHANNEL,
    JSON.stringify(event)
  );
}

// ===============================
// SUBSCRIBE
// ===============================
export async function subscribeRealtimeEvents(
  callback: (event: any) => void
) {
  const subscriber = redis.duplicate();

  await subscriber.connect();

  await subscriber.subscribe(
    CHANNEL,
    (message: string) => {
      try {
        callback(JSON.parse(message));
      } catch (err) {
        console.error(
          "❌ Realtime parse failed:",
          err
        );
      }
    }
  );
}