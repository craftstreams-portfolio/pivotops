/**
 * Distributed rate limiter.
 *
 * Uses Upstash Redis (REST API, serverless-safe) when credentials are present,
 * so limits are shared across all instances and survive cold starts.
 * Falls back to an in-memory Map when UPSTASH_REDIS_REST_URL is absent, so
 * local dev and preview deploys work without credentials — behaviour is
 * identical, just not shared across instances.
 */

export interface RateLimitConfig { limit: number; windowSec: number; }
export interface RateLimitResult { allowed: boolean; remaining: number; resetAt: number; }

// ── in-memory fallback ──────────────────────────────────────────────────────
interface WindowEntry { count: number; resetAt: number; }
const memStore = new Map<string, WindowEntry>();
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore.entries()) {
      if (entry.resetAt < now) memStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

function checkMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  let entry = memStore.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    memStore.set(key, entry);
    return { allowed: true, remaining: config.limit - 1, resetAt: entry.resetAt };
  }
  entry.count++;
  memStore.set(key, entry);
  const remaining = Math.max(0, config.limit - entry.count);
  return { allowed: entry.count <= config.limit, remaining, resetAt: entry.resetAt };
}

// ── Upstash sliding window ──────────────────────────────────────────────────
// Each key holds an INCR counter that expires after the window. This is
// intentionally a fixed window (not a true sliding window) — it matches the
// previous in-memory behaviour exactly, so limits don't tighten on deploy.
async function checkUpstash(
  key: string,
  config: RateLimitConfig,
  url: string,
  token: string
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const resetAt   = Date.now() + config.windowSec * 1000;

  try {
    // INCR returns the new count; set expiry on first request only (NX).
    const [incrRes, _] = await Promise.all([
      fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${config.windowSec}/nx`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (!incrRes.ok) throw new Error("Upstash INCR failed");
    const { result: count } = await incrRes.json() as { result: number };

    const remaining = Math.max(0, config.limit - count);
    return { allowed: count <= config.limit, remaining, resetAt };
  } catch {
    // Network or auth failure — degrade to permissive rather than blocking
    // legitimate traffic because Redis is temporarily unavailable.
    return { allowed: true, remaining: config.limit, resetAt };
  }
}

// ── public API ──────────────────────────────────────────────────────────────
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return checkUpstash(key, config, url, token);
  return checkMemory(key, config);
}

export const RATE_LIMITS = {
  public:        { limit: 10,  windowSec: 60 },
  authenticated: { limit: 120, windowSec: 60 },
  auth:          { limit: 5,   windowSec: 60 },
  internal:      { limit: 500, windowSec: 60 },
};