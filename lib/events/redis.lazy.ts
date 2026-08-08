import { createClient, RedisClientType } from "redis";

/**
 * Lazy, optional Redis.
 *
 * Every module in this subsystem used to call `redis.connect()` at import time,
 * so merely importing one — which ~30 files do — dialled Redis during build and
 * on every cold start, filling the logs with ENOTFOUND. Credentials aren't set
 * in production, so those connections were never going to succeed.
 *
 * This connects on first real use and returns null when REDIS_URL is absent, so
 * callers degrade quietly instead of throwing. Set REDIS_URL and it starts
 * working with no further changes.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pivotRedis: RedisClientType | undefined;
  // eslint-disable-next-line no-var
  var __pivotRedisReady: Promise<RedisClientType | null> | undefined;
}

export function redisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

export async function getRedisOrNull(): Promise<RedisClientType | null> {
  if (!redisConfigured()) return null;
  if (globalThis.__pivotRedisReady) return globalThis.__pivotRedisReady;

  globalThis.__pivotRedisReady = (async () => {
    try {
      const client: RedisClientType =
        globalThis.__pivotRedis ?? createClient({ url: process.env.REDIS_URL });

      // Without a listener, a connection error becomes an unhandled rejection
      // and can take the process down.
      client.on("error", () => {});

      if (!client.isOpen) await client.connect();
      globalThis.__pivotRedis = client;
      return client;
    } catch {
      // Reset so a later call can retry rather than caching the failure forever.
      globalThis.__pivotRedisReady = undefined;
      return null;
    }
  })();

  return globalThis.__pivotRedisReady;
}