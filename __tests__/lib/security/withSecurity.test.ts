import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSecurity } from "../../../lib/security/withSecurity";
vi.mock("../../../lib/security/apiAuth", () => ({ validateSession: vi.fn(), getClientIp: vi.fn(() => "127.0.0.1") }));
import { validateSession } from "../../../lib/security/apiAuth";
const TestSchema = z.object({ name: z.string().min(1), age: z.coerce.number().min(0) });
function makeRequest(body?: unknown, method = "POST", ip = "1.2.3.4") {
  return new NextRequest("http://localhost:3000/api/test", { method, headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: body ? JSON.stringify(body) : undefined });
}
describe("withSecurity", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("returns 401 when auth required and no session", async () => {
    vi.mocked(validateSession).mockResolvedValue(null);
    const handler = withSecurity(async () => NextResponse.json({ ok: true }), { requireAuth: true, rateLimit: { limit: 100, windowSec: 60 } });
    const res = await handler(makeRequest({}, "POST", "2.2.2.2"));
    expect(res.status).toBe(401);
  });
  it("passes through when auth not required", async () => {
    const handler = withSecurity(async () => NextResponse.json({ ok: true }), { requireAuth: false, rateLimit: { limit: 100, windowSec: 60 } });
    const res = await handler(makeRequest({}, "POST", "3.3.3.3"));
    expect(res.status).toBe(200);
  });
  it("returns 422 on schema validation failure", async () => {
    const handler = withSecurity(async () => NextResponse.json({ ok: true }), { schema: TestSchema, requireAuth: false, rateLimit: { limit: 100, windowSec: 60 } });
    const res = await handler(makeRequest({ name: "", age: -1 }, "POST", "4.4.4.4"));
    expect(res.status).toBe(422);
    const body = await res.json(); expect(body.issues).toBeDefined();
  });
  it("returns 429 when rate limit exceeded", async () => {
    const ip = `10.${Math.floor(Math.random()*255)}.0.1`;
    const handler = withSecurity(async () => NextResponse.json({ ok: true }), { requireAuth: false, rateLimit: { limit: 2, windowSec: 60 } });
    await handler(makeRequest(undefined, "GET", ip)); await handler(makeRequest(undefined, "GET", ip));
    const res = await handler(makeRequest(undefined, "GET", ip));
    expect(res.status).toBe(429); expect(res.headers.get("Retry-After")).toBeTruthy();
  });
  it("returns 403 when role not met", async () => {
    vi.mocked(validateSession).mockResolvedValue({ userId: "u1", tenantId: "t1", role: "employee", email: "e@e.com" });
    const handler = withSecurity(async () => NextResponse.json({ ok: true }), { requireAuth: true, requireRole: ["admin"], rateLimit: { limit: 100, windowSec: 60 } });
    const res = await handler(makeRequest(undefined, "GET", "5.5.5.5"));
    expect(res.status).toBe(403);
  });
  it("passes validated body to handler", async () => {
    let received: unknown;
    const handler = withSecurity<z.infer<typeof TestSchema>>(async (_req, { body }) => { received = body; return NextResponse.json({ ok: true }); }, { schema: TestSchema, requireAuth: false, rateLimit: { limit: 100, windowSec: 60 } });
    await handler(makeRequest({ name: "Alice", age: "30" }, "POST", "6.6.6.6"));
    expect(received).toEqual({ name: "Alice", age: 30 });
  });
});