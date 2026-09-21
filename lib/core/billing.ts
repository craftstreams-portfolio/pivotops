import { supabase } from "../supabase";

// ===============================
// TYPES
// ===============================
export type Plan = "free" | "pro" | "enterprise";

type Resource = "candidates" | "tasks";

// ===============================
// PLAN LIMITS
// ===============================
const limits: Record<Plan, Record<Resource, number>> = {
  free: {
    candidates: 50,
    tasks: 100,
  },

  pro: {
    candidates: 1000,
    tasks: 5000,
  },

  enterprise: {
    candidates: Infinity,
    tasks: Infinity,
  },
};

// ===============================
// FEATURE MATRIX
// ===============================
const featureMatrix: Record<Plan, string[]> = {
  free: ["recruitment", "tasks", "basic_analytics"],

  pro: [
    "recruitment",
    "tasks",
    "advanced_analytics",
    "clocking",
    "spotlight",
    "showcase",
  ],

  enterprise: ["*"],
};

// ===============================
// GET TENANT PLAN
// ===============================
export async function getTenantPlan(tenant_id: string): Promise<Plan> {
  if (!tenant_id) return "free";

  const { data, error } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenant_id)
    .single();

  if (error || !data?.plan) return "free";

  return data.plan as Plan;
}

// ===============================
// GET TENANT USAGE
// ===============================
export async function getTenantUsage(tenant_id: string) {
  if (!tenant_id) return { candidates: 0, tasks: 0 };

  const [{ count: candidates }, { count: tasks }] = await Promise.all([
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id),

    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id),
  ]);

  return {
    candidates: candidates || 0,
    tasks: tasks || 0,
  };
}

// ===============================
// GET PLAN LIMITS
// ===============================
export function getLimits(plan: Plan) {
  return limits[plan];
}

// ===============================
// CHECK LIMIT
// ===============================
export function checkLimit(
  plan: Plan,
  resource: Resource,
  currentUsage: number
): boolean {
  const limit = limits[plan][resource];

  if (limit === Infinity) return true;

  return currentUsage < limit;
}

// ===============================
// ASSERT LIMIT (HARD BLOCK)
// ===============================
export function assertLimit(
  plan: Plan,
  resource: Resource,
  currentUsage: number
) {
  if (!checkLimit(plan, resource, currentUsage)) {
    throw new Error(
      `BILLING BLOCKED: ${resource} limit exceeded on ${plan} plan`
    );
  }
}

// ===============================
// FEATURE CHECK
// ===============================
export function hasFeature(plan: Plan, feature: string): boolean {
  const allowed = featureMatrix[plan];

  if (!allowed) return false;
  if (allowed.includes("*")) return true;

  return allowed.includes(feature);
}

// ===============================
// FEATURE GUARD
// ===============================
export function assertFeature(plan: Plan, feature: string) {
  if (!hasFeature(plan, feature)) {
    throw new Error(
      `FEATURE BLOCKED: ${feature} not available on ${plan} plan`
    );
  }
}

// ===============================
// BILLING GUARD WRAPPER
// ===============================
export async function withBilling<T>(
  tenant_id: string,
  resource: Resource,
  callback: () => Promise<T>
): Promise<T | null> {
  const plan = await getTenantPlan(tenant_id);
  const usage = await getTenantUsage(tenant_id);

  const currentUsage = usage[resource] || 0;

  if (!checkLimit(plan, resource, currentUsage)) {
    console.warn(`[BILLING BLOCKED] ${plan} exceeded ${resource}`);
    return null;
  }

  return await callback();
}