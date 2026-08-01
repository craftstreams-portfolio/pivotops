import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * app/api/shopify/callback/route.ts
 *
 * Shopify redirects here after the merchant approves the OAuth consent screen.
 * Verifies HMAC and CSRF state, exchanges the code for an access token, upserts
 * the shopify_installs row, then branches:
 *   - no PivotOps session  -> /shopify/claim  (new merchant, create a tenant)
 *   - has a PivotOps session -> /shopify/link (existing account, confirm-link)
 * Never auto-links silently - linking always requires explicit confirmation.
 *
 * ISOLATION: net-new file. Does not import from or write to anything under
 * app/api/shopline/ or app/onboarding/. Uses SHOPIFY_APP_KEY /
 * SHOPIFY_APP_SECRET / SHOPIFY_REDIRECT_URL exclusively.
 */

function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

function verifyHmac(searchParams: URLSearchParams, secret: string): boolean {
  const params = new URLSearchParams(searchParams);
  const hmac = params.get("hmac");
  if (!hmac) return false;
  params.delete("hmac");
  params.delete("signature");

  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
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

  const expectedState = req.cookies.get("shopify_oauth_state")?.value;
  const expectedShop = req.cookies.get("shopify_oauth_shop")?.value;

  if (!expectedState || returnedState !== expectedState) {
    console.error("[shopify/callback] State mismatch.", { shop });
    return NextResponse.json({ error: "Invalid state parameter." }, { status: 403 });
  }
  if (expectedShop && expectedShop !== shop) {
    console.error("[shopify/callback] Shop mismatch.", { shop, expectedShop });
    return NextResponse.json({ error: "Shop mismatch." }, { status: 403 });
  }
  if (!verifyHmac(params, apiSecret)) {
    console.error("[shopify/callback] HMAC verification failed.", { shop });
    return NextResponse.json({ error: "Request verification failed." }, { status: 403 });
  }

  let accessToken: string;
  let grantedScope: string;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[shopify/callback] Token exchange failed:", tokenRes.status, body);
      return NextResponse.json({ error: "Failed to complete installation." }, { status: 502 });
    }
    const tokenData = await tokenRes.json() as { access_token: string; scope: string };
    accessToken = tokenData.access_token;
    grantedScope = tokenData.scope;
  } catch (err) {
    console.error("[shopify/callback] Token exchange threw:", err);
    return NextResponse.json({ error: "Failed to complete installation." }, { status: 502 });
  }

  // ── Upsert shopify_installs (full unique index on shop — no partial-index
  // ON CONFLICT ambiguity, unlike the bug that hit SHOPLINE's Entry-B) ───────
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("shopify_installs")
    .select("id, tenant_id")
    .eq("shop", shop)
    .maybeSingle();

  if (existing) {
    await admin.from("shopify_installs")
      .update({ access_token: accessToken, scope: grantedScope, updated_at: now })
      .eq("id", existing.id);
  } else {
    await admin.from("shopify_installs")
      .insert({ shop, access_token: accessToken, scope: grantedScope, installed_at: now, updated_at: now });
  }

  const res = existing?.tenant_id
    // Already claimed by a tenant previously - nothing more to do, just confirm.
    ? NextResponse.redirect(new URL(`/shopify/link?shop=${encodeURIComponent(shop)}&already_linked=1`, req.url))
    : NextResponse.redirect(await routeByAuthState(req, shop));

  res.cookies.delete("shopify_oauth_state");
  res.cookies.delete("shopify_oauth_shop");
  return res;
}

/** Branch to claim (no session) or link (existing session) — never auto-link. */
async function routeByAuthState(req: NextRequest, shop: string): Promise<URL> {
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Read the Supabase session cookie the same way the SSR client would, without
  // importing the SSR helper used elsewhere — kept self-contained here.
  const sbCookie = req.cookies.getAll().find(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
  if (sbCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sbCookie.value));
      const accessToken = parsed?.access_token;
      if (accessToken) {
        const { data: { user } } = await authClient.auth.getUser(accessToken);
        if (user) {
          return new URL(`/shopify/link?shop=${encodeURIComponent(shop)}`, req.url);
        }
      }
    } catch {
      // Malformed cookie - fall through to claim.
    }
  }

  return new URL(`/shopify/claim?shop=${encodeURIComponent(shop)}`, req.url);
}