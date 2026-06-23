import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/auth/withSecurity";
import { getPriceId } from "@/lib/paddle/config";
import type { PlanTier, BillingCycle } from "@/lib/paddle/config";
import { z } from "zod";

const CheckoutSchema = z.object({
  plan:  z.enum(["starter","professional","enterprise"]),
  cycle: z.enum(["monthly","annual"]),
});

export const POST = withSecurity(
  async (req, ctx, body) => {
    const { plan, cycle } = body as { plan: Exclude<PlanTier,"free">; cycle: BillingCycle };
    const { tenantId, email } = ctx;

    const priceId = getPriceId(plan, cycle);
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";

    // Build Paddle checkout URL via API
    const res = await fetch("https://api.paddle.com/transactions", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${process.env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        customer: { email },
        custom_data: { tenant_id: tenantId },
        settings: {
          success_url:  `${appUrl}/dashboard/settings/billing?success=true`,
          allow_logout: false,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Paddle Checkout] Failed:", err);
      return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
    }

    const data = await res.json();
    const checkoutUrl = data?.data?.checkout?.url;

    return NextResponse.json({ url: checkoutUrl, transactionId: data?.data?.id });
  },
  { schema: CheckoutSchema }
);