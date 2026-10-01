import { Redis } from "@upstash/redis";

/**
 * Optional Upstash client. Constructed on first use rather than at import, and
 * null when credentials are absent, so a missing env var no longer produces a
 * failed connection on every cold start.
 */
let cached: Redis | null | undefined;

export function getUpstash(): Redis | null {
  if (cached !== undefined) return cached;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}