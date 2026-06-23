import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/auth/withSecurity";
import { getSubscription, cancelSubscription } from "@/lib/paddle/subscription";

export const POST = withSecurity(
  async (_req, ctx) => {
    const { tenantId } = ctx;
    const sub = await getSubscription(tenantId);

    if (!sub?.paddle_subscription_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    // Tell Paddle to cancel at period end
    const res = await fetch(`https://api.paddle.com/subscriptions/${sub.paddle_subscription_id}/cancel`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${process.env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Paddle Cancel] Failed:", err);
      return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
    }

    await cancelSubscription(tenantId);
    return NextResponse.json({ ok: true, message: "Subscription will cancel at end of billing period" });
  },
  {}
);