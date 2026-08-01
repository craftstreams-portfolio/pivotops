import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * app/api/shopify/callback/route.ts
 *
 * Shopify redirects here after the merchant approves the OAuth consent screen.
 * Verifies the request HMAC and CSRF state, exchanges the authorization code
 * for a permanent access token, then hands off to tenant creation.
 *
 * ISOLATION: net-new file. Does not import from or write to anything under
 * app/api/shopline/. Uses SHOPIFY_APP_KEY / SHOPIFY_APP_SECRET /
 * SHOPIFY_REDIRECT_URL exclusively.
 *
 * TENANT LINKING NOT YET IMPLEMENTED — see TODO at the bottom. Deliberately
 * left as a stopping point rather than guessing at a "pending install"
 * schema, which is exactly the class of mistake that broke SHOPLINE's
 * Entry-B flow (a partial unique index Postgres could not infer for
 * ON CONFLICT, silently dropping the row).
 */

function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

/** Verifies Shopify's HMAC over the full query string, per their OAuth spec. */
function verifyHmac(searchParams: URLSearchParams, secret: string): boolean {
  const params = new URLSearchParams(searchParams);
  const hmac = params.get("hmac");
  if (!hmac) return false;
  params.delete("hmac");
  params.delete("signature"); // legacy param some flows include, must be excluded too

  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  // Constant-time compare - avoid leaking timing info on a security check.
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const shop = params.get("shop");
  const code = params.get("code");
  const returnedState = params.get("state");

  const apiKey = process.env.SHOPIFY_APP_KEY;
  const apiSecret = process.env.SHOPIFY_APP_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("[shopify/callback] Missing SHOPIFY_APP_KEY or SHOPIFY_APP_SECRET env var.");
    return NextResponse.json({ error: "App is not configured correctly." }, { status: 500 });
  }

  if (!shop || !isValidShopDomain(shop) || !code) {
    return NextResponse.json({ error: "Invalid callback parameters." }, { status: 400 });
  }

  // ── CSRF check ──────────────────────────────────────────────────────────
  const expectedState = req.cookies.get("shopify_oauth_state")?.value;
  const expectedShop = req.cookies.get("shopify_oauth_shop")?.value;

  if (!expectedState || returnedState !== expectedState) {
    console.error("[shopify/callback] State mismatch - possible CSRF attempt.", { shop });
    return NextResponse.json({ error: "Invalid state parameter." }, { status: 403 });
  }
  if (expectedShop && expectedShop !== shop) {
    console.error("[shopify/callback] Shop mismatch between install and callback.", { shop, expectedShop });
    return NextResponse.json({ error: "Shop mismatch." }, { status: 403 });
  }

  // ── HMAC check ──────────────────────────────────────────────────────────
  if (!verifyHmac(params, apiSecret)) {
    console.error("[shopify/callback] HMAC verification failed.", { shop });
    return NextResponse.json({ error: "Request verification failed." }, { status: 403 });
  }

  // ── Exchange the authorization code for a permanent access token ─────────
  let accessToken: string;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[shopify/callback] Token exchange failed:", tokenRes.status, body);
      return NextResponse.json({ error: "Failed to complete installation." }, { status: 502 });
    }

    const tokenData = await tokenRes.json() as { access_token: string; scope: string };
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error("[shopify/callback] Token exchange threw:", err);
    return NextResponse.json({ error: "Failed to complete installation." }, { status: 502 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TODO: link this shop + accessToken to a PivotOps tenant.
  //
  // This is the exact decision point that broke SHOPLINE's Entry-B flow, so
  // it is intentionally not guessed at here. Before writing this section,
  // confirm:
  //   1. New table name for pending Shopify installs (NOT shared with any
  //      shopline_* table) - e.g. shopify_pending_installs.
  //   2. Whether the unique constraint needed is a full unique index or a
  //      partial one - if partial, confirm Postgres can infer it for
  //      ON CONFLICT, or use explicit select-then-insert/update instead.
  //   3. Claim-flow expiry - SHOPLINE settled on 24h to match verification
  //      email lifetime; decide fresh for Shopify rather than assuming same.
  //
  // For now, log receipt so the OAuth round trip itself can be verified end
  // to end before any database write is added.
  // ─────────────────────────────────────────────────────────────────────────
  console.log("[shopify/callback] OAuth succeeded, token received.", { shop });

  const res = NextResponse.redirect(new URL("/onboarding?shopify_shop=" + encodeURIComponent(shop), req.url));
  res.cookies.delete("shopify_oauth_state");
  res.cookies.delete("shopify_oauth_shop");
  return res;
}