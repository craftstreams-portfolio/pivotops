import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyShopifyWebhook } from "@/lib/shopify/signature";

export const dynamic = "force-dynamic";

/**
 * app/api/shopify/webhooks/shop/redact/route.ts
 *
 * Mandatory GDPR compliance webhook. Sent 48h after a merchant uninstalls,
 * confirming they want their shop data redacted. ISOLATION: net-new.
 */

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_APP_SECRET ?? "";

  if (!verifyShopifyWebhook(rawBody, hmac, secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const webhookId = req.headers.get("x-shopify-webhook-id") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "shop/redact";
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep empty */ }

  const admin = getAdmin();

  if (webhookId) {
    const { data: seen } = await admin
      .from("shopify_webhook_events")
      .select("webhook_id")
      .eq("webhook_id", webhookId)
      .maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  await admin.from("shopify_webhook_events").insert({
    webhook_id: webhookId || `${topic}-${Date.now()}`,
    topic, shop_domain: shopDomain, payload,
  });

  // GDPR action: revoke the stored access token and mark the install
  // uninstalled. Tenant workforce data owned by the merchant is retained per
  // their PivotOps account terms unless they also delete that account -
  // shop/redact only concerns the Shopify connection itself.
  try {
    if (shopDomain) {
      await admin.from("shopify_installs")
        .update({ access_token: null, uninstalled_at: new Date().toISOString() })
        .eq("shop", shopDomain);
    }
  } catch (err) {
    console.error("[shopify shop/redact] cleanup error", err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "shopify/webhooks/shop/redact", status: "ok" });
}