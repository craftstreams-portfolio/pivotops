"use client";

import { ReactNode } from "react";
import { Lock, Sparkles, Loader2 } from "lucide-react";
import { useSubscription } from "@/lib/paddle/gate";
import { PLAN_FEATURES } from "@/lib/paddle/config";
import type { PlanTier } from "@/lib/paddle/config";

type GatedFeature = "compliance" | "complianceAdvanced" | "analytics" | "conference" | "clocking" | "tasks" | "showcase" | "spotlight" | "pivotsos" | "workflows" | "customIntegrations" | "prioritySupport";

// The minimum plan that unlocks each feature (for the upgrade prompt copy)
const FEATURE_MIN_PLAN: Record<GatedFeature, PlanTier> = {
  compliance:         "starter",
  complianceAdvanced: "professional",
  analytics:          "professional",
  conference:         "professional",
  clocking:           "professional",
  tasks:              "professional",
  showcase:           "professional",
  spotlight:          "professional",
  pivotsos:           "enterprise",
  workflows:          "enterprise",
  customIntegrations: "enterprise",
  prioritySupport:    "enterprise",
};

export function FeatureGate({
  tenantId,
  feature,
  children,
  title,
}: {
  tenantId: string;
  feature: GatedFeature;
  children: ReactNode;
  title?: string;
}) {
  const sub = useSubscription(tenantId);

  if (sub.loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  const hasAccess = sub.features[feature] === true;
  if (hasAccess) return <>{children}</>;

  const minPlan = FEATURE_MIN_PLAN[feature];
  const minPlanName = PLAN_FEATURES[minPlan].name;
  const featureLabel = title ?? feature;

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/25
                        flex items-center justify-center mx-auto mb-5">
          <Lock size={24} className="text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{featureLabel} is a {minPlanName} feature</h2>
        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
          Your current plan ({PLAN_FEATURES[sub.plan].name}) does not include {featureLabel.toLowerCase()}.
          Upgrade to {minPlanName} to unlock it.
        </p>
        <a href="/dashboard/settings/billing"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl
                     bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                     text-white text-sm font-semibold transition">
          <Sparkles size={15} />
          Upgrade to {minPlanName}
        </a>
      </div>
    </div>
  );
}