import "server-only";

import { createClient, RedisClientType } from "redis";
import type { EventContext } from "./event.context";

// ===============================
// GLOBAL REDIS SINGLETON (SSR SAFE)
// ===============================
declare global {
  // eslint-disable-next-line no-var
  var __eventLoggerRedis: RedisClientType | undefined;
}

const redis: RedisClientType =
  globalThis.__eventLoggerRedis ??
  createClient({
    url: process.env.REDIS_URL,
  });

// ===============================
// SAFE CONNECT (NO DUPLICATES)
// ===============================
if (!globalThis.__eventLoggerRedis) {
  redis.connect().catch((err: unknown) => {
    console.error("❌ Redis connection failed:", err);
  });

  globalThis.__eventLoggerRedis = redis;
}

// ===============================
// TRACE KEY
// ===============================
const TRACE_KEY = "pivotops:event:trace";

// ===============================
// TRACE ENTRY TYPE
// ===============================
export type TraceEntry = {
  context: EventContext;
  stage: string;
  message?: string;
  timestamp: number;
};

// ===============================
// LOG TRACE
// ===============================
export async function logTrace(
  context: EventContext,
  stage: string,
  message?: string
) {
  try {
    const entry: TraceEntry = {
      context,
      stage,
      message,
      timestamp: Date.now(),
    };

    await redis.lPush(TRACE_KEY, JSON.stringify(entry));
  } catch (err: unknown) {
    console.error("❌ trace failed:", err);
  }
}

// ===============================
// GET TRACE (OPTION A FIX APPLIED)
// ===============================
export async function getEventTrace(
  eventId?: string
): Promise<TraceEntry[]> {
  try {
    const items = await redis.lRange(TRACE_KEY, 0, 200);

    const parsed: TraceEntry[] = items
      .map((i: string) => {
        try {
          return JSON.parse(i) as TraceEntry;
        } catch {
          return null;
        }
      })
      .filter((t): t is TraceEntry => t !== null);

    // ===============================
    // FULL REPLAY MODE (NO ARG)
    // ===============================
    if (!eventId) return parsed;

    // ===============================
    // FILTERED MODE
    // ===============================
    return parsed.filter(
      (t) => t.context?.eventId === eventId
    );
  } catch (err: unknown) {
    console.error("❌ getEventTrace failed:", err);
    return [];
  }
}