import crypto from "crypto";

/**
 * lib/shopify/linkGrant.ts
 *
 * Short-lived signed proof that the server verified a user's session during
 * the OAuth callback. The link page cannot always re-verify client-side -
 * Supabase reads from storage that is blocked on a cross-site redirect in
 * incognito, which is how app reviewers test - so the callback signs who it
 * saw and the link API trusts that signature instead of a bearer token.
 *
 * Signed with SHOPIFY_APP_SECRET. Scoped to one shop, expires in 15 minutes,
 * so it cannot be replayed against a different store or reused later.
 */

interface GrantPayload {
  userId: string;
  email: string;
  shop: string;
  exp: number; // epoch seconds
}

const TTL_SECONDS = 15 * 60;

function secret(): string {
  const s = process.env.SHOPIFY_APP_SECRET;
  if (!s) throw new Error("SHOPIFY_APP_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createLinkGrant(userId: string, email: string, shop: string): string {
  const payload: GrantPayload = {
    userId, email, shop,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the payload if the grant is valid for this shop, else null. */
export function verifyLinkGrant(grant: string, shop: string): GrantPayload | null {
  const [body, sig] = grant.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as GrantPayload;
    if (payload.shop !== shop) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}