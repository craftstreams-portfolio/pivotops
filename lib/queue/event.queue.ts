import { getRedis } from "../redis/client";

const QUEUE_KEY = "pivotops:event:queue";

// ===============================
// EVENT TYPE (STRICT)
// ===============================
type QueueEvent = {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  created_at: number;
};

// ===============================
// PUSH EVENT INTO REDIS QUEUE
// ===============================
export async function enqueueEvent(event: {
  type: string;
  payload: any;
}): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return null;          // no queue configured

  const job: QueueEvent = {
    id: crypto.randomUUID(),
    type: String(event.type),
    payload: event.payload,
    attempts: 0,
    created_at: Date.now(),
  };

  // node-redis is camelCase; the previous lpush/rpop/llen calls would have
  // thrown at runtime even with a live connection.
  await redis.lPush(QUEUE_KEY, JSON.stringify(job));
  return job.id;
}

// ===============================
// POP EVENT (WORKER USE ONLY)
// ===============================
export async function dequeueEvent(): Promise<QueueEvent | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const data = await redis.rPop(QUEUE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(typeof data === "string" ? data : String(data)) as QueueEvent;
  } catch (err) {
    console.error("Failed to parse queue event:", err);
    return null;
  }
}

// ===============================
// QUEUE SIZE (DEBUGGING)
// ===============================
export async function getQueueLength(): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;
  const len = await redis.lLen(QUEUE_KEY);
  return typeof len === "number" ? len : parseInt(String(len), 10) || 0;
}