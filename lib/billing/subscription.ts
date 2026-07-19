import { createClient } from "@supabase/supabase-js";
import type { PlanTier, BillingCycle } from "./config";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Subscription {
  id:                     string;
  tenant_id:              string;
  paddle_customer_id:     string | null;
  paddle_subscription_id: string | null;
  plan:                   PlanTier;
  billing_cycle:          BillingCycle;
  status:                 "trialing" | "active" | "past_due" | "canceled" | "paused";
  price_id:               string | null;
  current_period_start:   string | null;
  current_period_end:     string | null;
  cancel_at_period_end:   boolean;
  trial_ends_at:          string | null;
  created_at:             string;
  updated_at:             string;
}

export async function getSubscription(tenantId: string): Promise<Subscription | null> {
  const { data, error } = await adminSupabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (error) return null;
  return data as Subscription;
}

export async function upsertSubscription(
  tenantId: string,
  updates: Partial<Omit<Subscription, "id" | "tenant_id" | "created_at">>
): Promise<void> {
  await adminSupabase
    .from("subscriptions")
    .upsert({
      tenant_id:  tenantId,
      updated_at: new Date().toISOString(),
      ...updates,
    }, { onConflict: "tenant_id" });
}

export async function cancelSubscription(tenantId: string): Promise<void> {
  await adminSupabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
}

export async function getSubscriptionByPaddleId(paddleSubId: string): Promise<Subscription | null> {
  const { data } = await adminSupabase
    .from("subscriptions")
    .select("*")
    .eq("paddle_subscription_id", paddleSubId)
    .single();
  return data as Subscription | null;
}