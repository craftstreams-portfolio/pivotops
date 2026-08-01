import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyShopifyWebhook } from "@/lib/shopify/signature";

export const dynamic = "force-dynamic";

/**
 * app/api/shopify/webhooks/customers/data_request/route.ts
 *
 * Mandatory GDPR compliance webhook. A store's customer requested a copy of
 * their data. ISOLATION: net-new.
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
  const topic = req.headers.get("x-shopify-topic") ?? "customers/data_request";
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

  // GDPR action: a customer data-access request. PivotOps stores workforce
  // data keyed to the merchant's tenant, not the store's end customers, so
  // there is typically no customer PII to return. Logged for audit; a match
  // (if any) is the merchant's to fulfil within the GDPR response window.

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "shopify/webhooks/customers/data_request", status: "ok" });
}