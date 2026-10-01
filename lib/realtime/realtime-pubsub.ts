import { getRedis } from "../redis/client";

const CHANNEL = "pivotops:realtime";

// ===============================
// PUBLISH EVENT
// ===============================
export async function publishRealtimeEvent(event: any): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;               // no pub/sub configured
  await redis.publish(CHANNEL, JSON.stringify(event));
}

// ===============================
// SUBSCRIBE
// ===============================
export async function subscribeRealtimeEvents(
  callback: (event: any) => void
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  // A subscriber connection can't issue other commands, so it must be its own
  // client rather than the shared one.
  const subscriber = redis.duplicate();
  subscriber.on("error", () => {});
  await subscriber.connect();
  await subscriber.subscribe(CHANNEL, (message: string) => {
    try {
      callback(JSON.parse(message));
    } catch (err) {
      console.error("Realtime parse failed:", err);
    }
  });
}