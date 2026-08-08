import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyShopifyWebhook } from "@/lib/shopify/signature";

export const dynamic = "force-dynamic";

/**
 * app/api/shopify/webhooks/customers/redact/route.ts
 *
 * Mandatory GDPR compliance webhook. Shopify sends this when a store's
 * customer requests their data be redacted. ISOLATION: net-new, no shopline
 * or onboarding imports.
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
  const topic = req.headers.get("x-shopify-topic") ?? "customers/redact";
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

  // GDPR action: redact a specific customer. PivotOps does not store
  // store-customer PII by default; this is a no-op unless a matching email
  // exists in candidate_accounts (PivotOps' own data model, not
  // platform-specific - the same table SHOPLINE's handler checks).
  try {
    const email = (payload?.customer?.email ?? "").toLowerCase();
    if (email) {
      await admin.from("candidate_accounts").delete().eq("email", email);
    }
  } catch (err) {
    console.error("[shopify customers/redact] cleanup error", err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "shopify/webhooks/customers/redact", status: "ok" });
}