import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "../../lib/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls console.info for info level", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test message", { userId: "abc" });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("test message");
    expect(parsed.userId).toBe("abc");
    expect(parsed.service).toBe("pivotops");
  });

  it("calls console.error for error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("something broke");
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("something broke");
  });

  it("calls console.warn for warn level", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("rate limit hit");
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
  });

  it("includes all meta fields in output", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test", { tenantId: "t1", count: 5 });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.tenantId).toBe("t1");
    expect(parsed.count).toBe(5);
    expect(parsed.timestamp).toBeTruthy();
  });
});