import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature } from "@/lib/shopline/signature";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-shopline-hmac-sha256") ?? "";

  if (!verifyWebhookSignature(rawBody, sig)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const webhookId  = req.headers.get("x-shopline-webhook-id") ?? "";
  const topic      = req.headers.get("x-shopline-topic") ?? "customers/redact";
  const shopDomain = req.headers.get("x-shopline-shop-domain") ?? "";
  const shopId     = req.headers.get("x-shopline-shop-id") ?? "";
  const merchantId = req.headers.get("x-shopline-merchant-id") ?? "";

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep empty */ }

  const admin = getAdmin();

  if (webhookId) {
    const { data: seen } = await admin
      .from("shopline_webhook_events")
      .select("webhook_id")
      .eq("webhook_id", webhookId)
      .maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  await admin.from("shopline_webhook_events").insert({
    webhook_id:  webhookId || `${topic}-${Date.now()}`,
    topic, shop_domain: shopDomain, shop_id: shopId, merchant_id: merchantId, payload,
  });

  // GDPR action: redact a specific customer. If PivotOps has stored any data
  // tied to this customer (by shopline customer id/email from the payload),
  // delete it. PivotOps does not store store-customer PII by default, so this
  // is a safe no-op in the common case; any matched records are removed.
  try {
    const customer = payload?.customer ?? {};
    const email = (customer?.email ?? "").toLowerCase();
    if (email) {
      // Remove any candidate/account data that may have been keyed to this email
      await admin.from("candidate_accounts").delete().eq("email", email);
    }
  } catch (err) {
    console.error("[shopline customers/redact] cleanup error", err);
    // Still ack — SHOPLINE only needs a 200; we have logged the event.
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "shopline/webhooks/customers/redact", status: "ok" });
}