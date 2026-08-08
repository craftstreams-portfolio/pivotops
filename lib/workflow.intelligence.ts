import { supabase } from "@/lib/supabase";
import { getCandidateWorkflow } from "@/lib/workflow";

/**
 * ─────────────────────────────────────────────
 * WORKFLOW INTELLIGENCE LAYER (PivotOps Core)
 * ─────────────────────────────────────────────
 */

type Insight = {
  score: number;
  riskLevel: "low" | "medium" | "high";
  nextAction: string;
  summary: string;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * MAIN INTELLIGENCE ENGINE
 */
export async function getCandidateIntelligence(
  candidateId: string
): Promise<Insight> {
  const events = await getCandidateWorkflow(candidateId);

  if (!events.length) {
    return {
      score: 10,
      riskLevel: "low",
      nextAction: "start_review",
      summary: "No workflow activity yet",
    };
  }

  const now = Date.now();

  let score = 50;

  let hasOnboarded = false;
  let hasDeclined = false;
  let lastEventAgeDays = 0;

  for (const e of events) {
    const age = now - new Date(e.created_at).getTime();

    if (e.event_type === "ONBOARDING_TRIGGERED") score += 25;
    if (e.event_type === "CANDIDATE_DECLINED") hasDeclined = true;
    if (e.event_type === "CANDIDATE_HIRED") hasOnboarded = true;

    lastEventAgeDays = Math.max(lastEventAgeDays, age / (1000 * 60 * 60 * 24));
  }

  // ── Risk rules ───────────────────────────────
  if (hasDeclined) score = 0;
  if (hasOnboarded) score = 100;

  // inactivity penalty
  if (lastEventAgeDays > 7) score -= 15;
  if (lastEventAgeDays > 14) score -= 25;

  score = clamp(score);

  // ── Risk classification ──────────────────────
  let riskLevel: "low" | "medium" | "high" = "low";

  if (score < 40) riskLevel = "high";
  else if (score < 70) riskLevel = "medium";

  // ── Next action logic (Xavier brain) ─────────
  let nextAction = "continue_processing";

  if (hasDeclined) nextAction = "archive";
  else if (score < 40) nextAction = "manual_review";
  else if (score >= 70) nextAction = "fast_track";
  else nextAction = "monitor";

  return {
    score,
    riskLevel,
    nextAction,
    summary: buildSummary(events, score),
  };
}

/**
 * HUMAN-READABLE SUMMARY (for UI + Xavier)
 */
function buildSummary(events: any[], score: number) {
  const last = events[0];

  return `
Candidate has ${events.length} workflow events.
Last event: ${last?.event_type ?? "none"}.
Intelligence score: ${score}/100.
  `.trim();
}

/**
 * BULK INSIGHTS (for dashboards)
 */
export async function getWorkflowDashboard(tenantId: string) {
  const { data, error } = await supabase
    .from("workflow_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[workflow-intel] dashboard error:", error.message);
    return [];
  }

  const grouped: Record<string, any[]> = {};

  for (const event of data ?? []) {
    if (!grouped[event.candidate_id]) {
      grouped[event.candidate_id] = [];
    }
    grouped[event.candidate_id].push(event);
  }

  return Object.entries(grouped).map(([candidateId, events]) => ({
    candidateId,
    eventCount: events.length,
    lastEvent: events[0],
  }));
}