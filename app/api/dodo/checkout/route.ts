import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dodo } from "@/lib/dodo/client";
import { getDodoProductId, DODO_CONFIG } from "@/lib/dodo/config";
import type { PlanTier, BillingCycle } from "@/lib/dodo/config";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdmin();
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    const { plan, cycle } = (await req.json()) as { plan: Exclude<PlanTier,"free">; cycle: BillingCycle };
    if (!plan || !cycle) {
      return NextResponse.json({ error: "plan and cycle are required" }, { status: 400 });
    }

    const productId = getDodoProductId(plan, cycle);
    if (!productId) {
      return NextResponse.json({ error: `No Dodo product configured for ${plan}/${cycle}` }, { status: 400 });
    }

    const email = userData.user.email ?? "";

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url:   DODO_CONFIG.returnUrl,
      metadata:     { tenant_id: profile.tenant_id, plan, cycle },
      ...(email ? { customer: { email, name: email } } : {}),
    });

    if (!session?.checkout_url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 502 });
    }

    return NextResponse.json({ checkout_url: session.checkout_url, session_id: session.session_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dodo/checkout]", msg);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}