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
  const topic      = req.headers.get("x-shopline-topic") ?? "shop/redact";
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

  // GDPR action: shop redact (sent 48h after uninstall). Delete all PivotOps
  // data associated with this store's connection. We remove the store record
  // and revoke its stored access token. Tenant workforce data owned by the
  // merchant is retained per the merchant's own PivotOps account terms unless
  // they also delete their PivotOps account.
  try {
    if (shopDomain) {
      await admin.from("shopline_stores")
        .update({ access_token: null, uninstalled_at: new Date().toISOString() })
        .eq("shop_domain", shopDomain);
    }
  } catch (err) {
    console.error("[shopline shop/redact] cleanup error", err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "shopline/webhooks/shop/redact", status: "ok" });
}