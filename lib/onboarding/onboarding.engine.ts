import { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStatus =
  | "pending"
  | "documents"
  | "training"
  | "active"
  | "completed"
  | "rejected";

export interface OnboardingUser {
  id: string;
  candidate_id: string;
  tenant_id: string;
  name: string;
  email: string;
  department?: string | null;
  status: OnboardingStatus;
  created_at: string;
  updated_at?: string;
}

/**
 * Supabase returns PostgREST error objects { message, code, details, hint }
 * — plain objects, NOT JS Error instances.
 * console.error(supabaseError) logs as {} because JSON.stringify drops
 * non-enumerable properties. Always extract .message first.
 */
function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────
export async function createOnboardingUser(
  supabase: SupabaseClient,
  payload: Partial<OnboardingUser>
) {
  if (!payload.candidate_id) {
    throw new Error("candidate_id is required to create an onboarding profile");
  }

  // Dedup — silently return if already exists
  const { data: existing, error: lookupError } = await supabase
  .from("onboarding")
  .select("*")
  .eq("candidate_id", payload.candidate_id)
  .maybeSingle();

  if (lookupError) {
    throw new Error(`Onboarding lookup failed: ${extractMessage(lookupError)}`);
  }

  if (existing) {
    console.warn("Onboarding already exists for candidate:", payload.candidate_id);
    return existing;
  }

  const { data, error } = await supabase
    .from("onboarding")
    .insert({
      candidate_id: payload.candidate_id,
      tenant_id:    payload.tenant_id  ?? null,
      name:         payload.name       ?? null,
      email:        payload.email      ?? null,
      department:   payload.department ?? null,
      status:       payload.status     ?? "pending",
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Onboarding insert failed: ${extractMessage(error)}`);
  }

  return data;
}

// ─────────────────────────────────────────
// UPDATE STATUS
// ─────────────────────────────────────────
export async function updateOnboardingStatus(
  supabase: SupabaseClient,
  id: string,
  status: OnboardingStatus
) {
  if (!id) throw new Error("Onboarding id is required");

  const { data, error } = await supabase
    .from("onboarding")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Onboarding update failed: ${extractMessage(error)}`);
  }

  return data;
}

// ─────────────────────────────────────────
// GET ALL
// ─────────────────────────────────────────
export async function getOnboardingUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("onboarding")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Onboarding fetch failed: ${extractMessage(error)}`);
  }

  return data ?? [];
}

// ─────────────────────────────────────────
// GET BY CANDIDATE ID
// ─────────────────────────────────────────
export async function getOnboardingByCandidateId(
  supabase: SupabaseClient,
  candidate_id: string
) {
  if (!candidate_id) throw new Error("candidate_id is required");

  const { data, error } = await supabase
    .from("onboarding")
    .select("*")
    .eq("candidate_id", candidate_id)
    .maybeSingle();

  if (error) {
    throw new Error(`Onboarding lookup failed: ${extractMessage(error)}`);
  }

  return data;
}