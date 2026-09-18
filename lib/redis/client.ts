import type { RedisClientType } from "redis";
import { getRedisOrNull, redisConfigured } from "../events/redis.lazy";

/**
 * Optional Redis client.
 *
 * This used to call createClient() at module load, so importing it anywhere
 * dialled Redis during build. It now shares the lazy connector and returns null
 * when REDIS_URL is unset, letting callers degrade instead of throwing.
 */
export async function getRedis(): Promise<RedisClientType | null> {
  return getRedisOrNull();
}

export { redisConfigured };