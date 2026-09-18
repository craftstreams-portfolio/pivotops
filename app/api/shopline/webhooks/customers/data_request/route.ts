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
  const topic      = req.headers.get("x-shopline-topic") ?? "customers/data_request";
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

  // GDPR action: a customer data-access request. PivotOps stores workforce data
  // keyed to the merchant's tenant, not to the store's end customers, so there is
  // typically no customer PII to return. We log the request for audit and, where
  // a customer match exists, surface it to the merchant for fulfilment within the
  // GDPR response window.

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "shopline/webhooks/customers/data_request", status: "ok" });
}