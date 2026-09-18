import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * app/api/shopify/install/route.ts
 *
 * Entry point set as this app's "App URL" in the Shopify Partner Dashboard.
 * Shopify redirects a merchant here with ?shop=xxx.myshopify.com when they
 * click Install. This route validates the shop param, generates a CSRF state
 * token, and redirects to Shopify's OAuth consent screen.
 *
 * ISOLATION: net-new file. Does not import from or write to anything under
 * app/api/shopline/. Uses SHOPIFY_APP_KEY / SHOPIFY_APP_SECRET /
 * SHOPIFY_REDIRECT_URL exclusively — never the SHOPLINE_* equivalents.
 */

const SCOPES = "read_locations";

function isValidShopDomain(shop: string): boolean {
  // Must be a bare xxx.myshopify.com host - nothing else, no path, no scheme.
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");

  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Missing or invalid shop parameter." },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHOPIFY_APP_KEY;
  const redirectUrl = process.env.SHOPIFY_REDIRECT_URL;

  if (!apiKey || !redirectUrl) {
    console.error("[shopify/install] Missing SHOPIFY_APP_KEY or SHOPIFY_REDIRECT_URL env var.");
    return NextResponse.json(
      { error: "App is not configured correctly. Contact support." },
      { status: 500 }
    );
  }

  // CSRF state - verified against the cookie in the callback route.
  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", apiKey);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("redirect_uri", redirectUrl);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());

  // Short-lived, httpOnly - only needs to survive the redirect round trip.
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60, // 10 minutes
    path: "/",
  });
  res.cookies.set("shopify_oauth_shop", shop, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return res;
}