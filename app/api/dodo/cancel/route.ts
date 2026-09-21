import { NextResponse } from "next/server";
import { withSecurity } from "@/lib/auth/withSecurity";
import { createClient } from "@supabase/supabase-js";
import { dodo } from "@/lib/dodo/client";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const POST = withSecurity(
  async (_req, ctx) => {
    const { tenantId } = ctx;
    const admin = getAdmin();

    const { data: sub } = await admin
      .from("subscriptions")
      .select("dodo_subscription_id, status")
      .eq("tenant_id", tenantId)
      .single();

    if (!sub?.dodo_subscription_id) {
      return NextResponse.json({ error: "No active subscription to cancel." }, { status: 400 });
    }

    // Cancel at end of billing period (customer keeps access until then).
    await dodo.subscriptions.update(sub.dodo_subscription_id, {
      cancel_at_next_billing_date: true,
      cancel_reason: "cancelled_by_customer",
    });

    // Reflect the pending cancellation locally so the UI can show it.
    // The subscription.cancelled webhook will flip status to "canceled" when the period ends.
    await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("tenant_id", tenantId);

    return NextResponse.json({
      ok: true,
      message: "Your subscription will cancel at the end of the current billing period.",
    });
  },
  {}
);