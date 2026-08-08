import { NextRequest, NextResponse } from "next/server";
import { upsertSubscription, getSubscriptionByPaddleId } from "@/lib/billing/subscription";
import { emailSubscriptionConfirmed, emailPaymentFailed, emailPlanUpgraded, emailPlanDowngraded } from "@/lib/email/dispatch";
import { PLAN_FEATURES } from "@/lib/billing/config";
import type { PlanTier, BillingCycle } from "@/lib/billing/config";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify Paddle webhook signature
async function verifyPaddleSignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;

  const signatureHeader = req.headers.get("paddle-signature");
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(";").map(p => p.split("=") as [string, string])
  );
  const ts  = parts["ts"];
  const h1  = parts["h1"];
  if (!ts || !h1) return false;

  const encoder = new TextEncoder();
  const keyData  = encoder.encode(secret);
  const msgData  = encoder.encode(`${ts}:${body}`);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return hex === h1;
}

function extractPlan(priceId: string): { plan: PlanTier; cycle: BillingCycle } {
  const map: Record<string, { plan: PlanTier; cycle: BillingCycle }> = {
    "pri_01kvszav16dtwgmsb8f0nm4pgk": { plan: "starter",      cycle: "monthly" },
    "pri_01kvszhvqz5dhkhpwbek90k307": { plan: "starter",      cycle: "annual"  },
    "pri_01kvszqz7vnyfcawqp62j1cwwn": { plan: "professional", cycle: "monthly" },
    "pri_01kvszv2eags8czzmm797xpgep": { plan: "professional", cycle: "annual"  },
    "pri_01kvszy7b6bq375mtv301jqs6f": { plan: "enterprise",   cycle: "monthly" },
    "pri_01kvt01w96j96v2yr9y0xp16f6": { plan: "enterprise",   cycle: "annual"  },
  };
  return map[priceId] ?? { plan: "starter", cycle: "monthly" };
}

async function getTenantEmail(tenantId: string): Promise<{ email: string; name: string; orgName: string } | null> {
  const { data } = await adminSupabase
    .from("profiles")
    .select("email, full_name, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (!data) return null;

  const { data: tenant } = await adminSupabase
    .from("tenants")
    .select("org_name")
    .eq("id", tenantId)
    .single();

  return {
    email:   data.email ?? "",
    name:    data.full_name ?? "there",
    orgName: tenant?.org_name ?? tenantId,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  const valid = await verifyPaddleSignature(req, body);
  if (!valid) {
    console.error("[Paddle Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event_type as string;
  const data      = event.data;

  console.log(`[Paddle Webhook] ${eventType}`, data?.id);

  try {
    // ── subscription.created ────────────────────────────────────────────────
    if (eventType === "subscription.created" || eventType === "subscription.activated") {
      const tenantId   = data.custom_data?.tenant_id ?? data.customer?.custom_data?.tenant_id;
      if (!tenantId) { console.error("[Paddle] No tenant_id in subscription"); return NextResponse.json({ ok: true }); }

      const priceId    = data.items?.[0]?.price?.id;
      const { plan, cycle } = extractPlan(priceId);

      await upsertSubscription(tenantId, {
        paddle_customer_id:     data.customer_id,
        paddle_subscription_id: data.id,
        plan,
        billing_cycle:          cycle,
        status:                 "active",
        price_id:               priceId,
        current_period_start:   data.current_billing_period?.starts_at,
        current_period_end:     data.current_billing_period?.ends_at,
        cancel_at_period_end:   false,
      });

      const contact = await getTenantEmail(tenantId);
      if (contact) {
        const amount = cycle === "monthly"
          ? `$${PLAN_FEATURES[plan].maxRecruiters === 999 ? "6,000" : plan === "professional" ? "2,500" : "1,500"}/mo`
          : plan === "enterprise" ? "$64,800/yr" : plan === "professional" ? "$27,000/yr" : "$16,200/yr";

        await emailSubscriptionConfirmed({
          to:              contact.email,
          userName:        contact.name,
          orgName:         contact.orgName,
          plan:            PLAN_FEATURES[plan].name,
          amount,
          billingCycle:    cycle === "monthly" ? "Monthly" : "Annual",
          nextBillingDate: new Date(data.current_billing_period?.ends_at ?? "").toLocaleDateString(),
        });
      }
    }

    // ── subscription.updated ────────────────────────────────────────────────
    if (eventType === "subscription.updated") {
      const existing = await getSubscriptionByPaddleId(data.id);
      if (!existing) return NextResponse.json({ ok: true });

      const priceId        = data.items?.[0]?.price?.id;
      const { plan, cycle } = extractPlan(priceId);
      const prevPlan       = existing.plan;

      await upsertSubscription(existing.tenant_id, {
        plan,
        billing_cycle:        cycle,
        status:               data.status === "active" ? "active" : data.status,
        price_id:             priceId,
        current_period_start: data.current_billing_period?.starts_at,
        current_period_end:   data.current_billing_period?.ends_at,
        cancel_at_period_end: data.scheduled_change?.action === "cancel",
      });

      // Send upgrade/downgrade email
      if (plan !== prevPlan) {
        const contact = await getTenantEmail(existing.tenant_id);
        if (contact) {
          const planNames   = ["free","starter","professional","enterprise"];
          const isUpgrade   = planNames.indexOf(plan) > planNames.indexOf(prevPlan);
          const newAmount   = plan === "enterprise" ? "$6,000/mo" : plan === "professional" ? "$2,500/mo" : "$1,500/mo";

          if (isUpgrade) {
            await emailPlanUpgraded({
              to:            contact.email,
              userName:      contact.name,
              orgName:       contact.orgName,
              fromPlan:      PLAN_FEATURES[prevPlan].name,
              toPlan:        PLAN_FEATURES[plan].name,
              newAmount,
              effectiveDate: new Date().toLocaleDateString(),
            });
          } else {
            await emailPlanDowngraded({
              to:            contact.email,
              userName:      contact.name,
              orgName:       contact.orgName,
              fromPlan:      PLAN_FEATURES[prevPlan].name,
              toPlan:        PLAN_FEATURES[plan].name,
              newAmount,
              effectiveDate: new Date().toLocaleDateString(),
            });
          }
        }
      }
    }

    // ── subscription.canceled ───────────────────────────────────────────────
    if (eventType === "subscription.canceled") {
      const existing = await getSubscriptionByPaddleId(data.id);
      if (existing) {
        await upsertSubscription(existing.tenant_id, { status: "canceled", plan: "free" });
      }
    }

    // ── transaction.payment_failed ──────────────────────────────────────────
    if (eventType === "transaction.payment_failed") {
      const subId   = data.subscription_id;
      const existing = subId ? await getSubscriptionByPaddleId(subId) : null;
      if (existing) {
        await upsertSubscription(existing.tenant_id, { status: "past_due" });
        const contact = await getTenantEmail(existing.tenant_id);
        if (contact) {
          await emailPaymentFailed({
            to:        contact.email,
            userName:  contact.name,
            orgName:   contact.orgName,
            amount:    `$${data.details?.totals?.grand_total ?? "?"}`,
            retryDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString(),
          });
        }
      }
    }

    // ── transaction.completed ───────────────────────────────────────────────
    if (eventType === "transaction.completed") {
      const subId   = data.subscription_id;
      const existing = subId ? await getSubscriptionByPaddleId(subId) : null;
      if (existing && existing.status === "past_due") {
        await upsertSubscription(existing.tenant_id, { status: "active" });
      }
    }

  } catch (err) {
    console.error("[Paddle Webhook] Handler error:", err);
  }

  // Always return 200 — Paddle retries on non-200
  return NextResponse.json({ ok: true });
}