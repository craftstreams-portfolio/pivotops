import { createOnboardingUser } from "../onboarding/onboarding.engine";
 
const ACCEPTED_STATUSES = new Set(["recruitment_review", "hired", "accepted"]);
 
/**
 * Called from onDragEnd after a candidate is moved to a new column.
 *
 * FIX: receives `newStatus` as a parameter instead of reading
 * candidate.status, which still holds the OLD value at call time
 * because the DB write is async and React state hasn't re-rendered yet.
 */
export async function handleRecruitmentToOnboarding(
  candidate: any,
  supabase: any,
  newStatus: string        // ← the column they were just dropped into
) {
  if (!candidate?.id) {
    console.warn("handleRecruitmentToOnboarding: missing candidate id — skipping");
    return;
  }
 
  // Only trigger for accepted stages
  if (!ACCEPTED_STATUSES.has(newStatus)) return;
 
  try {
    await createOnboardingUser(supabase, {
  candidate_id: candidate.id,
  email:        candidate.email ?? null,
  name: candidate.name || "Unknown Candidate",
  department: candidate.department ?? null,
  status:     "pending",
});
 
    console.log(`Recruitment → Onboarding triggered for candidate ${candidate.id}`);
  } catch (err) {
    // err.message is now always readable (fixed in onboarding.engine.ts)
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Recruitment → Onboarding failed:", msg);
    // Do NOT re-throw — onboarding failure must not roll back the recruitment move
  }
}