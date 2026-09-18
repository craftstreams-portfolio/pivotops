import crypto from "crypto";

/**
 * lib/shopify/signature.ts
 *
 * Verifies Shopify webhook HMAC signatures.
 *
 * Shopify signs the RAW request body with HMAC-SHA256 using the app's client
 * secret, base64-encodes the digest, and sends it in the
 * X-Shopify-Hmac-Sha256 header. This is a different scheme from SHOPLINE's
 * (hex digest, different header name) - do not reuse lib/shopline/signature.ts.
 *
 * The comparison decodes BOTH the computed digest and the header value from
 * base64 to raw bytes before timingSafeEqual. Comparing the base64 strings
 * directly (a common mistake) can throw on length mismatch or, worse, is not
 * a true constant-time comparison of the underlying bytes.
 *
 * ISOLATION: net-new file. No import from or reference to lib/shopline/*.
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    const a = Buffer.from(computed, "base64");
    const b = Buffer.from(hmacHeader, "base64");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}