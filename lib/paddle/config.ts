export const PADDLE_CONFIG = {
  clientToken:  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
  environment:  (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox") as "sandbox" | "production",
  apiKey:       process.env.PADDLE_API_KEY ?? "",
  webhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? "",
  prices: {
    starter: {
      monthly: process.env.PADDLE_PRICE_STARTER_MONTHLY ?? "pri_01kvszav16dtwgmsb8f0nm4pgk",
      annual:  process.env.PADDLE_PRICE_STARTER_ANNUAL  ?? "pri_01kvszhvqz5dhkhpwbek90k307",
    },
    professional: {
      monthly: process.env.PADDLE_PRICE_PROFESSIONAL_MONTHLY ?? "pri_01kvszqz7vnyfcawqp62j1cwwn",
      annual:  process.env.PADDLE_PRICE_PROFESSIONAL_ANNUAL  ?? "pri_01kvszv2eags8czzmm797xpgep",
    },
    enterprise: {
      monthly: process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY ?? "pri_01kvszy7b6bq375mtv301jqs6f",
      annual:  process.env.PADDLE_PRICE_ENTERPRISE_ANNUAL  ?? "pri_01kvt01w96j96v2yr9y0xp16f6",
    },
  },
} as const;

export type PlanTier = "free" | "starter" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export const PLAN_FEATURES: Record<PlanTier, {
  name:           string;
  maxRecruiters:  number;
  compliance:     boolean;
  analytics:      boolean;
  conference:     boolean;
  clocking:       boolean;
  tasks:          boolean;
  customIntegrations: boolean;
  prioritySupport:    boolean;
}> = {
  free: {
    name:               "Free Trial",
    maxRecruiters:      2,
    compliance:         false,
    analytics:          false,
    conference:         false,
    clocking:           false,
    tasks:              false,
    customIntegrations: false,
    prioritySupport:    false,
  },
  starter: {
    name:               "Starter",
    maxRecruiters:      5,
    compliance:         false,
    analytics:          false,
    conference:         false,
    clocking:           false,
    tasks:              false,
    customIntegrations: false,
    prioritySupport:    false,
  },
  professional: {
    name:               "Professional",
    maxRecruiters:      20,
    compliance:         true,
    analytics:          true,
    conference:         true,
    clocking:           true,
    tasks:              true,
    customIntegrations: false,
    prioritySupport:    false,
  },
  enterprise: {
    name:               "Enterprise",
    maxRecruiters:      999,
    compliance:         true,
    analytics:          true,
    conference:         true,
    clocking:           true,
    tasks:              true,
    customIntegrations: true,
    prioritySupport:    true,
  },
};

export function getPriceId(plan: Exclude<PlanTier,"free">, cycle: BillingCycle): string {
  return PADDLE_CONFIG.prices[plan][cycle];
}

export function canAccessFeature(plan: PlanTier, feature: keyof typeof PLAN_FEATURES["enterprise"]): boolean {
  return PLAN_FEATURES[plan][feature] as boolean;
}