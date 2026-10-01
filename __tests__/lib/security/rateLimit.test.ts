import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, RATE_LIMITS } from "../../../lib/security/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("allows requests within the limit", async () => {
    const key = `test-ip:${Date.now()}`; const cfg = { limit: 3, windowSec: 60 };
    const r1 = await checkRateLimit(key, cfg);
    const r2 = await checkRateLimit(key, cfg);
    const r3 = await checkRateLimit(key, cfg);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", async () => {
    const key = `test-block:${Date.now()}`; const cfg = { limit: 2, windowSec: 60 };
    await checkRateLimit(key, cfg);
    await checkRateLimit(key, cfg);
    const r3 = await checkRateLimit(key, cfg);
    expect(r3.allowed).toBe(false);
  });

  it("resets after the window expires", async () => {
    const key = `test-reset:${Date.now()}`; const cfg = { limit: 1, windowSec: 10 };
    await checkRateLimit(key, cfg);
    const blocked = await checkRateLimit(key, cfg);
    expect(blocked.allowed).toBe(false);
    vi.advanceTimersByTime(11_000);
    const reset = await checkRateLimit(key, cfg);
    expect(reset.allowed).toBe(true);
  });

  it("RATE_LIMITS presets have sensible values", () => {
    expect(RATE_LIMITS.public.limit).toBeLessThanOrEqual(20);
    expect(RATE_LIMITS.auth.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.authenticated.limit).toBeGreaterThan(RATE_LIMITS.public.limit);
  });
});