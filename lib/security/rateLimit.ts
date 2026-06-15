interface WindowEntry { count: number; resetAt: number; }
const store = new Map<string, WindowEntry>();
if (typeof setInterval !== "undefined") {
  setInterval(() => { const now = Date.now(); for (const [key, entry] of store.entries()) { if (entry.resetAt < now) store.delete(key); } }, 5 * 60 * 1000);
}
export interface RateLimitConfig { limit: number; windowSec: number; }
export interface RateLimitResult { allowed: boolean; remaining: number; resetAt: number; }
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: config.limit - 1, resetAt: entry.resetAt };
  }
  entry.count++;
  store.set(key, entry);
  const remaining = Math.max(0, config.limit - entry.count);
  return { allowed: entry.count <= config.limit, remaining, resetAt: entry.resetAt };
}
export const RATE_LIMITS = {
  public:        { limit: 10,  windowSec: 60 },
  authenticated: { limit: 120, windowSec: 60 },
  auth:          { limit: 5,   windowSec: 60 },
  internal:      { limit: 500, windowSec: 60 },
};