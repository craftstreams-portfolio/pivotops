import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * app/api/shopify/welcome/route.ts
 *
 * Shopify App Pricing redirects here after a merchant approves a plan,
 * appending plan_handle and shop. Shopify created the subscription and
 * handles the charge - this records which plan the merchant is on so feature
 * gating matches what they are paying for.
 *
 * Shopify App Pricing sends no webhooks for subscription changes, so this
 * redirect is the primary signal; cancellations and freezes are read from the
 * Partner API separately.
 */

const VALID_PLANS = new Set(["starter", "professional", "enterprise"]);

export async function GET(req: NextRequest) {
  const planHandle = req.nextUrl.searchParams.get("plan_handle");
  const shop = req.nextUrl.searchParams.get("shop");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
    ? "https://www.pivotops.app"
    : (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app");

  if (!planHandle || !shop) {
    return NextResponse.redirect(new URL("/dashboard", appUrl));
  }

  const plan = planHandle.toLowerCase();
  if (!VALID_PLANS.has(plan)) {
    console.error("[shopify/welcome] unrecognised plan_handle:", planHandle);
    return NextResponse.redirect(new URL("/dashboard", appUrl));
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: install } = await admin
    .from("shopify_installs")
    .select("tenant_id")
    .eq("shop", shop)
    .maybeSingle();

  if (!install?.tenant_id) {
    console.error("[shopify/welcome] no linked tenant for shop:", shop);
    return NextResponse.redirect(new URL("/dashboard", appUrl));
  }

  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", install.tenant_id)
    .maybeSingle();

  const row = {
    tenant_id:           install.tenant_id,
    plan,
    billing_cycle:       "monthly",
    status:              "active",
    billing_provider:    "shopify",
    shopify_plan_handle: planHandle,
    cancel_at_period_end: false,
    trial_ends_at:       null,
    updated_at:          now,
  };

  if (existing) {
    await admin.from("subscriptions").update(row).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({ ...row, created_at: now });
  }

  await admin.from("tenants").update({ plan }).eq("id", install.tenant_id);

  await admin.from("audit_logs").insert({
    tenant_id: install.tenant_id,
    action: "billing.plan_changed",
    entity_type: "subscription",
    entity_id: install.tenant_id,
    metadata: { plan, shop, provider: "shopify" },
    severity: "info",
    created_at: now,
  });

  return NextResponse.redirect(new URL("/dashboard?plan=" + plan, appUrl));
}