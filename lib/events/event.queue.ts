import "server-only";

import { createClient, RedisClientType } from "redis";

// ===============================
// GLOBAL REDIS SINGLETON SAFE
// ===============================
declare global {
  // eslint-disable-next-line no-var
  var __redis: RedisClientType | undefined;
}

// ===============================
// REDIS CLIENT INIT
// ===============================
const redis: RedisClientType =
  globalThis.__redis ??
  createClient({
    url: process.env.REDIS_URL,
  });

// ===============================
// CONNECT ONCE SAFELY
// ===============================
if (!globalThis.__redis) {
  redis.connect().catch((err: unknown) => {
    console.error("❌ Redis connection failed:", err);
  });

  globalThis.__redis = redis;
}

// ===============================
// QUEUE KEYS
// ===============================
const QUEUE_KEY = "pivotops:event:queue";
const LOCK_KEY_PREFIX = "pivotops:event:lock:";
const DEAD_QUEUE_KEY = "pivotops:event:dead";

// ===============================
// TYPE
// ===============================
export type QueuedEvent = {
  id: string;
  type: string;
  payload: unknown;
  attempts?: number;
  status?: "queued" | "processing" | "processed" | "failed";
};

// ===============================
// ENQUEUE EVENT
// ===============================
export async function enqueueEvent(event: QueuedEvent) {
  if (!event?.id || !event?.type) return;

  try {
    const existing = await redis.zRange(QUEUE_KEY, 0, -1);

    const alreadyExists = existing.some((item: string) => {
      try {
        return JSON.parse(item)?.id === event.id;
      } catch {
        return false;
      }
    });

    if (alreadyExists) return;

    const payload: QueuedEvent = {
      ...event,
      attempts: event.attempts ?? 0,
      status: event.status ?? "queued",
    };

    await redis.zAdd(QUEUE_KEY, {
      score: Date.now(),
      value: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    console.error("❌ Failed to enqueue event:", err);
  }
}

// ===============================
// GET NEXT BATCH
// ===============================
export async function getNextBatch(limit: number): Promise<QueuedEvent[]> {
  try {
    const items = await redis.zRange(QUEUE_KEY, 0, limit - 1);

    return items
      .map((i: string) => {
        try {
          return JSON.parse(i) as QueuedEvent;
        } catch {
          return null;
        }
      })
      .filter((i): i is QueuedEvent => i !== null);
  } catch (err: unknown) {
    console.error("❌ Failed to fetch batch:", err);
    return [];
  }
}

// ===============================
// DEQUEUE EVENT (SAFE FIFO)
// ===============================
export async function dequeueEvent(): Promise<QueuedEvent | null> {
  try {
    const items = await redis.zRange(QUEUE_KEY, 0, 0);

    if (!items.length) return null;

    const raw = items[0];

    let parsed: QueuedEvent;

    try {
      parsed = JSON.parse(raw);
    } catch (err: unknown) {
      console.error("❌ Corrupt event removed:", err);
      await redis.zRem(QUEUE_KEY, raw);
      return null;
    }

    await redis.zRem(QUEUE_KEY, raw);

    return parsed;
  } catch (err: unknown) {
    console.error("❌ Queue dequeue failed:", err);
    return null;
  }
}

// ===============================
// LOCK EVENT
// ===============================
export async function lockEvent(id: string): Promise<boolean> {
  if (!id) return false;

  try {
    const key = `${LOCK_KEY_PREFIX}${id}`;

    const res = await redis.set(key, "locked", {
      NX: true,
      PX: 30000,
    });

    return res === "OK";
  } catch (err: unknown) {
    console.error("❌ Lock failed:", err);
    return false;
  }
}

// ===============================
// UNLOCK EVENT
// ===============================
export async function unlockEvent(id: string) {
  if (!id) return;

  try {
    await redis.del(`${LOCK_KEY_PREFIX}${id}`);
  } catch (err: unknown) {
    console.error("❌ Unlock failed:", err);
  }
}

// ===============================
// REMOVE EVENT
// ===============================
export async function removeEvent(id: string) {
  if (!id) return;

  try {
    const items = await redis.zRange(QUEUE_KEY, 0, -1);

    for (const item of items as string[]) {
      try {
        const parsed = JSON.parse(item);

        if (parsed?.id === id) {
          await redis.zRem(QUEUE_KEY, item);
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (err: unknown) {
    console.error("❌ Remove event failed:", err);
  }
}

// ===============================
// MOVE TO DEAD LETTER QUEUE
// ===============================
export async function moveToDeadQueue(event: QueuedEvent) {
  if (!event?.id) return;

  try {
    const payload = {
      ...event,
      status: "failed",
      failed_at: new Date().toISOString(),
    };

    await redis.zAdd(DEAD_QUEUE_KEY, {
      score: Date.now(),
      value: JSON.stringify(payload),
    });

    const items = await redis.zRange(QUEUE_KEY, 0, -1);

    const filtered = items.filter((i: string) => {
      try {
        return JSON.parse(i)?.id !== event.id;
      } catch {
        return true;
      }
    });

    await redis.del(QUEUE_KEY);

    if (filtered.length) {
      await redis.zAdd(
        QUEUE_KEY,
        filtered.map((v: string) => ({
          score: Date.now(),
          value: v,
        }))
      );
    }
  } catch (err: unknown) {
    console.error("❌ moveToDeadQueue failed:", err);
  }
}