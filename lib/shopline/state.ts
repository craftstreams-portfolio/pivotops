import crypto from "crypto";
import { SHOPLINE_APP_SECRET } from "./config";

// Signed, short-lived state for the OAuth flow. Carries the tenant (if known,
// Entry A) plus a nonce + timestamp, and is HMAC-signed to prevent tampering/CSRF.

const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface StatePayload {
  tenantId: string | null; // null for SHOPLINE-first installs (Entry B)
  handle: string;
  nonce: string;
  ts: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function createState(tenantId: string | null, handle: string): string {
  const payload: StatePayload = {
    tenantId,
    handle,
    nonce: crypto.randomBytes(8).toString("hex"),
    ts: Date.now(),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SHOPLINE_APP_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
  try {
    const [body, sig] = state.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", SHOPLINE_APP_SECRET).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StatePayload;
    if (Date.now() - payload.ts > TTL_MS) return null; // expired
    return payload;
  } catch {
    return null;
  }
}