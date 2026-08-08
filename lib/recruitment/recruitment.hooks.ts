const ACCEPTED_STATUSES = new Set(["recruitment_review", "hired", "accepted"]);

/**
 * Called from onDragEnd after a candidate is moved to a new column.
 * Onboarding rows are service-role-only (RLS), so we route the creation
 * through /api/onboarding instead of inserting from the browser.
 */
export async function handleRecruitmentToOnboarding(
  candidate: any,
  supabase: any,
  newStatus: string
) {
  if (!candidate?.id) {
    console.warn("handleRecruitmentToOnboarding: missing candidate id - skipping");
    return;
  }
  if (!ACCEPTED_STATUSES.has(newStatus)) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      console.error("Recruitment -> Onboarding: no session token; skipping");
      return;
    }
    const res = await fetch("/api/onboarding", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ candidateId: candidate.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Recruitment -> Onboarding failed:", data?.error || res.status);
      return;
    }
    console.log(`Recruitment -> Onboarding triggered for candidate ${candidate.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Recruitment -> Onboarding failed:", msg);
  }
}