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
  compliance:         boolean;   // document tracking / candidate portal
  complianceAdvanced: boolean;   // Compliance Status (advanced) — Professional+
  analytics:      boolean;
  conference:     boolean;
  clocking:       boolean;
  tasks:          boolean;
  showcase:       boolean;
  spotlight:      boolean;
  pivotsos:       boolean;
  workflows:      boolean;
  customIntegrations: boolean;
  prioritySupport:    boolean;
}> = {
  free: {
    name: "Free Trial", maxRecruiters: 2,
    compliance: false, complianceAdvanced: false, analytics: false, conference: false, clocking: false, tasks: false,
    showcase: false, spotlight: false, pivotsos: false, workflows: false,
    customIntegrations: false, prioritySupport: false,
  },
  starter: {
    name: "Starter", maxRecruiters: 5,
    compliance: true, complianceAdvanced: false, analytics: false, conference: false, clocking: false, tasks: false,
    showcase: false, spotlight: false, pivotsos: false, workflows: false,
    customIntegrations: false, prioritySupport: false,
  },
  professional: {
    name: "Professional", maxRecruiters: 20,
    compliance: true, complianceAdvanced: true, analytics: true, conference: true, clocking: true, tasks: true,
    showcase: true, spotlight: true, pivotsos: false, workflows: false,
    customIntegrations: false, prioritySupport: false,
  },
  enterprise: {
    name: "Enterprise", maxRecruiters: 999,
    compliance: true, complianceAdvanced: true, analytics: true, conference: true, clocking: true, tasks: true,
    showcase: true, spotlight: true, pivotsos: true, workflows: true,
    customIntegrations: true, prioritySupport: true,
  },
};

/**
 * Seats included in a plan. This is the ONLY definition — the invite route and
 * the team panel both read it, so the server cap and the UI counter can never
 * disagree. Seats were previously derived from tenants.org_size, the team-size
 * range picked at signup, which meant a Starter tenant who selected "50+" got
 * unlimited seats.
 */
/**
 * Tenants exempt from seat limits: the SHOPLINE review workspaces, which
 * reviewers must be able to populate regardless of plan. Anything added here
 * bypasses billing, so it should never grow without a reason recorded beside it.
 */
export const SEAT_EXEMPT_TENANTS: readonly string[] = [
  "pivotops-demo-mr2eh9yo",     // PivotOps Demo - SHOPLINE reviewer workspace
  "byc-staffing-inc-mqsjpn1q",  // BYC Staffing INC - shopline-review@pivotops.app
];

export function isSeatExempt(tenantId: string | null | undefined): boolean {
  return !!tenantId && SEAT_EXEMPT_TENANTS.includes(tenantId);
}

export function seatCapForPlan(plan: PlanTier | string | null | undefined): number {
  const key = (plan ?? "free") as PlanTier;
  return PLAN_FEATURES[key]?.maxRecruiters ?? PLAN_FEATURES.free.maxRecruiters;
}

export function planLabel(plan: PlanTier | string | null | undefined): string {
  const key = (plan ?? "free") as PlanTier;
  return PLAN_FEATURES[key]?.name ?? PLAN_FEATURES.free.name;
}

export function getPriceId(plan: Exclude<PlanTier,"free">, cycle: BillingCycle): string {
  return PADDLE_CONFIG.prices[plan][cycle];
}

export function canAccessFeature(plan: PlanTier, feature: keyof typeof PLAN_FEATURES["enterprise"]): boolean {
  return PLAN_FEATURES[plan][feature] as boolean;
}