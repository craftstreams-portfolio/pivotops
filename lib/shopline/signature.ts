import crypto from "crypto";

const APP_SECRET = process.env.SHOPLINE_APP_SECRET ?? "";

/** HMAC-SHA256, hex-encoded - the algorithm SHOPLINE uses for signatures. */
export function hmacSha256Hex(source: string, secret = APP_SECRET): string {
  return crypto.createHmac("sha256", secret).update(source, "utf8").digest("hex");
}

/** Constant-time string compare to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Verify a WEBHOOK signature (SHOPLINE -> us).
 * CONFIRMED: HMAC-SHA256 of the raw request body, hex-encoded,
 * delivered in the X-Shopline-Hmac-Sha256 header.
 */
export function verifyWebhookSignature(rawBody: string, headerSig: string): boolean {
  if (!headerSig) return false;
  const expected = hmacSha256Hex(rawBody);
  return timingSafeEqual(expected, headerSig);
}

/**
 * Verify a GET request signature (install + OAuth callback).
 * CONFIRMED (SHOPLINE generate-and-verify-signatures doc):
 * remove `sign`, sort remaining params alphabetically by key,
 * join as key=value with "&", HMAC-SHA256 hex, constant-time compare.
 */
export function verifyGetSignature(params: Record<string, string>): boolean {
  const { sign, ...rest } = params;
  if (!sign) return false;
  const sorted = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const expected = hmacSha256Hex(sorted);
  return timingSafeEqual(expected, sign);
}

/**
 * Sign an OUTBOUND POST to SHOPLINE (token create / refresh, API calls).
 * CONFIRMED: source = requestBody + timestamp(ms); HMAC-SHA256 hex.
 * Returns the headers SHOPLINE expects.
 */
export function signPostRequest(
  appKey: string,
  body: string,
  timestamp: string = Date.now().toString()
): Record<string, string> {
  const sign = hmacSha256Hex(body + timestamp);
  return {
    "Content-Type": "application/json",
    appkey: appKey,
    timestamp,
    sign,
  };
}

/**
 * Replay guard for GET/POST signatures. SHOPLINE timestamps are ms since epoch.
 * Rejects requests outside the allowed skew (default 10 minutes).
 */
export function timestampValid(ts: string | number, maxSkewMs = 10 * 60 * 1000): boolean {
  const t = typeof ts === "string" ? parseInt(ts, 10) : ts;
  return Number.isFinite(t) && Math.abs(Date.now() - t) <= maxSkewMs;
}