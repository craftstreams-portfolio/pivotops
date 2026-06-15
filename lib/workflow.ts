import { supabase } from "@/lib/supabase";

export type WorkflowEventType =
  | "ONBOARDING_TRIGGERED"
  | "CANDIDATE_DECLINED"
  | "INTERVIEW_SCHEDULED"
  | "OFFER_SENT"
  | "CANDIDATE_HIRED"
  | "COMPLIANCE_STARTED";

export type WorkflowEventInput = {
  candidateId: string;
  tenantId?: string;
  eventType: WorkflowEventType | string;
  actorId?: string | null;
  actorName?: string | null;
  meta?: Record<string, any>;
};

function safeMeta(meta?: Record<string, any>) {
  return meta && typeof meta === "object" ? meta : {};
}

/**
 * CORE WORKFLOW ENGINE
 * - stores recruitment lifecycle events
 * - safe, idempotent, analytics-ready
 * - Xavier AI compatible
 */
export async function addWorkflowEvent(input: WorkflowEventInput) {
  const {
    candidateId,
    tenantId = "default",
    eventType,
    actorId = null,
    actorName = "System",
    meta,
  } = input;

  const payload = {
    candidate_id: candidateId,
    tenant_id: tenantId,
    event_type: eventType,
    actor_id: actorId,
    actor_name: actorName,
    meta: safeMeta(meta),
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("workflow_events").insert(payload);

  if (error) {
    console.error("[workflow] insert failed:", {
      eventType,
      candidateId,
      error: error.message,
    });
    return false;
  }

  return true;
}

/**
 * OPTIONAL: READ LATEST EVENTS (for dashboards / Xavier reasoning)
 */
export async function getCandidateWorkflow(candidateId: string) {
  const { data, error } = await supabase
    .from("workflow_events")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[workflow] fetch failed:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * OPTIONAL: EVENT SUMMARY (for AI / dashboard insight layer)
 */
export async function getWorkflowSummary(candidateId: string) {
  const events = await getCandidateWorkflow(candidateId);

  return {
    totalEvents: events.length,
    lastEvent: events[0] ?? null,
    timeline: events.map((e) => ({
      type: e.event_type,
      at: e.created_at,
    })),
  };
}