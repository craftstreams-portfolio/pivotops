import type { PlanTier, BillingCycle } from "@/lib/billing/config";

// Reuse the single source of truth for features/tiers from the existing config.
export { PLAN_FEATURES, canAccessFeature } from "@/lib/billing/config";
export type { PlanTier, BillingCycle } from "@/lib/billing/config";

export const DODO_CONFIG = {
  apiKey:        process.env.DODO_PAYMENTS_API_KEY ?? "",
  webhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_SECRET ?? "",
  // "test_mode" | "live_mode" — Dodo SDK environment
  environment:   (process.env.DODO_PAYMENTS_ENV ?? "test_mode") as "test_mode" | "live_mode",
  // Where Dodo redirects after checkout completes
  returnUrl:     (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app") + "/dashboard/settings/billing?status=success",
  products: {
    starter: {
      monthly: process.env.DODO_PRODUCT_STARTER_MONTHLY ?? "",
      annual:  process.env.DODO_PRODUCT_STARTER_ANNUAL  ?? "",
    },
    professional: {
      monthly: process.env.DODO_PRODUCT_PROFESSIONAL_MONTHLY ?? "",
      annual:  process.env.DODO_PRODUCT_PROFESSIONAL_ANNUAL  ?? "",
    },
    enterprise: {
      monthly: process.env.DODO_PRODUCT_ENTERPRISE_MONTHLY ?? "",
      annual:  process.env.DODO_PRODUCT_ENTERPRISE_ANNUAL  ?? "",
    },
  },
} as const;

export function getDodoProductId(plan: Exclude<PlanTier, "free">, cycle: BillingCycle): string {
  return DODO_CONFIG.products[plan][cycle];
}