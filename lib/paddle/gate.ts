"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PLAN_FEATURES, canAccessFeature } from "./config";
import type { PlanTier } from "./config";

export interface SubscriptionState {
  plan:      PlanTier;
  status:    string;
  isActive:  boolean;
  isTrial:   boolean;
  features:  typeof PLAN_FEATURES["free"];
  loading:   boolean;
}

export function useSubscription(tenantId: string): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    plan:     "free",
    status:   "trialing",
    isActive: true,
    isTrial:  true,
    features: PLAN_FEATURES["free"],
    loading:  true,
  });

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("subscriptions")
      .select("plan, status, trial_ends_at, cancel_at_period_end")
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data }) => {
        if (!data) {
          setState(s => ({ ...s, loading: false }));
          return;
        }
        const plan     = (data.plan ?? "free") as PlanTier;
        const status   = data.status ?? "trialing";
        const isTrial  = status === "trialing";
        const isActive = status === "active" || isTrial;

        setState({
          plan,
          status,
          isActive,
          isTrial,
          features: PLAN_FEATURES[plan],
          loading:  false,
        });
      });
  }, [tenantId]);

  return state;
}

// Server-side gate check (use in API routes / server components)
export { canAccessFeature };