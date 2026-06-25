import crypto from "crypto";

const APP_SECRET = process.env.SHOPLINE_APP_SECRET ?? "";

/** HMAC-SHA256, hex-encoded — the algorithm SHOPLINE uses for signatures. */
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
 * Verify a WEBHOOK signature.
 * CONFIRMED by SHOPLINE docs: HMAC-SHA256 of the raw request body,
 * hex-encoded, delivered in the X-Shopline-Hmac-Sha256 header.
 */
export function verifyWebhookSignature(rawBody: string, headerSig: string): boolean {
  if (!headerSig) return false;
  const expected = hmacSha256Hex(rawBody);
  return timingSafeEqual(expected, headerSig);
}

/**
 * Verify a GET request signature (install + OAuth callback).
 * NOTE: the exact canonicalization (separator, hex vs base64) is pending
 * confirmation from SHOPLINE partner engineering. Current best-effort:
 * sort params (excluding sign), join key=value with "&", HMAC-SHA256 hex.
 * Swap this one function once the worked example is confirmed.
 */
export function verifyGetSignature(params: Record<string, string>): boolean {
  const { sign, ...rest } = params;
  if (!sign) return false;
  const sorted = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("&");
  const expected = hmacSha256Hex(sorted);
  return timingSafeEqual(expected, sign);
}

/** Build signed headers for outbound token create/refresh (pending confirmation). */
export function buildSignedHeaders(appKey: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const sign = hmacSha256Hex(`appkey=${appKey}&timestamp=${timestamp}`);
  return { "Content-Type": "application/json", appkey: appKey, timestamp, sign };
}