import { redis } from "../redis/client";

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
}) {
  const job: QueueEvent = {
    id: crypto.randomUUID(),
    type: String(event.type),
    payload: event.payload,
    attempts: 0,
    created_at: Date.now(),
  };

  await redis.lpush(QUEUE_KEY, JSON.stringify(job));

  console.log("📥 Event queued to Redis:", job.id);

  return job.id;
}

// ===============================
// POP EVENT (WORKER USE ONLY)
// ===============================
export async function dequeueEvent(): Promise<QueueEvent | null> {
  const data = await redis.rpop(QUEUE_KEY);

  if (!data) return null;

  try {
    const normalized =
      typeof data === "string"
        ? data
        : data.toString();

    return JSON.parse(normalized) as QueueEvent;
  } catch (err) {
    console.error("❌ Failed to parse queue event:", err);
    return null;
  }
}

// ===============================
// QUEUE SIZE (DEBUGGING)
// ===============================
export async function getQueueLength(): Promise<number> {
  const len = await redis.llen(QUEUE_KEY);

  if (typeof len === "string") return parseInt(len, 10);
  if (typeof len === "number") return len;

  return 0;
}