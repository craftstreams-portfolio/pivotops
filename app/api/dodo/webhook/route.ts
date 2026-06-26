import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "standardwebhooks";
import { upsertSubscription } from "@/lib/paddle/subscription";
import type { PlanTier, BillingCycle } from "@/lib/dodo/config";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Map Dodo subscription/payment event types to our internal subscription status
function statusForEvent(type: string): string | null {
  switch (type) {
    case "subscription.active":
    case "subscription.renewed":   return "active";
    case "subscription.on_hold":   return "paused";
    case "subscription.cancelled": return "canceled";
    case "subscription.expired":
    case "subscription.failed":    return "past_due";
    case "payment.succeeded":      return "active";
    case "payment.failed":         return "past_due";
    case "refund.succeeded":       return "canceled";
    default:                       return null;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Standard Webhooks verification (webhook-id / webhook-signature / webhook-timestamp)
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET ?? "";
  const headers = {
    "webhook-id":        req.headers.get("webhook-id")        ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
  };

  let event: any;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, headers);
  } catch (err) {
    console.error("[dodo/webhook] signature verification failed");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const webhookId = headers["webhook-id"];
  const eventType: string = event?.type ?? "";
  const data: any = event?.data ?? {};
  const admin = getAdmin();

  // Idempotency: skip if we have already processed this webhook id
  if (webhookId) {
    const { data: seen } = await admin
      .from("dodo_webhook_events")
      .select("webhook_id")
      .eq("webhook_id", webhookId)
      .maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  // Record the event (audit + idempotency)
  await admin.from("dodo_webhook_events").insert({
    webhook_id: webhookId || `${eventType}-${Date.now()}`,
    event_type: eventType,
    payload:    event ?? {},
  });

  // Resolve tenant from metadata we set at checkout
  const tenantId: string | undefined =
    data?.metadata?.tenant_id ?? data?.subscription?.metadata?.tenant_id;
  const plan  = data?.metadata?.plan  as PlanTier | undefined;
  const cycle = data?.metadata?.cycle as BillingCycle | undefined;

  const status = statusForEvent(eventType);

  if (tenantId && status) {
    const updates: Record<string, unknown> = { status };
    if (plan)  updates.plan = plan;
    if (cycle) updates.billing_cycle = cycle;
    if (data?.subscription_id) updates.dodo_subscription_id = data.subscription_id;
    if (data?.customer?.customer_id) updates.dodo_customer_id = data.customer.customer_id;
    if (data?.previous_period_end || data?.next_billing_date) {
      updates.current_period_end = data?.next_billing_date ?? data?.previous_period_end;
    }
    if (eventType === "subscription.cancelled") updates.cancel_at_period_end = true;

    try {
      await upsertSubscription(tenantId, updates as any);
    } catch (err) {
      console.error("[dodo/webhook] upsert failed", err);
      // Still ack — event is logged; avoid retries storm
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ route: "dodo/webhook", status: "ok" });
}