import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { createOnboardingUser } from "@/lib/onboarding/onboarding.engine";
import { xavierNotify } from "@/lib/recruitment/xavier.notifications";
import { logAudit } from "@/lib/audit";
import { addWorkflowEvent } from "@/lib/workflow";
const CandidateActionSchema = z.object({ action: z.enum(["proceed_onboarding","decline_candidate"]), candidateId: z.string().uuid(), actorName: z.string().max(255).optional().default("Recruiter"), declineReason: z.string().max(1000).optional(), messageId: z.string().uuid().optional() });
type CandidateActionInput = z.infer<typeof CandidateActionSchema>;
const COMPLIANCE_DOCS = ["Resume / CV","Nursing License","Driver's License","Flu Shot Record","COVID-19 Vaccination","Hepatitis B Record","MMR Vaccination","Chest X-Ray","BLS / CPR Certification","Drug Screening Results","Background Check"];
const CANDIDATES_CHANNEL_ID = "8a426d76-42a5-447b-a39b-7a9ea39f6a87";
async function postToChannel(channelId: string, content: string, tenantId: string, meta?: Record<string, unknown>) {
  await supabase.from("messages").insert({ channel_id: channelId, content, user_id: "00000000-0000-0000-0000-000000000000", user_name: "Xavier AI", tenant_id: tenantId, type: "system", retracted: false, reactions: {}, meta: meta ?? null, created_at: new Date().toISOString() });
}
export const POST = withSecurity<CandidateActionInput>(
  async (_req, { auth, body }) => {
    const tenantId = auth!.tenantId;
    const actorId = auth!.userId;
    const { action, candidateId, actorName, declineReason, messageId } = body;
    const { data: candidate, error } = await supabase.from("candidates").select("*").eq("id", candidateId).eq("tenant_id", tenantId).single();
    if (error || !candidate) return NextResponse.json({ error: "Candidate not found in your tenant." }, { status: 404 });
    const now = new Date().toISOString();
    const name = candidate.name ?? "Candidate";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (messageId) {
      const { data: msg } = await supabase.from("messages").select("meta").eq("id", messageId).single();
      if (msg) await supabase.from("messages").update({ meta: { ...(msg.meta ?? {}), actioned: true, actioned_by: actorName, actioned_at: now, action, candidate_id: candidateId } }).eq("id", messageId);
    }
    if (action === "proceed_onboarding") {
      await supabase.from("candidates").update({ status: "hired", decision: "STRONG_HIRE", offer_accepted_at: now, hired_at: now, updated_at: now }).eq("id", candidateId);
      const onboarding = await createOnboardingUser(supabase, { candidate_id: candidateId, name: candidate.name, email: candidate.email, department: candidate.department ?? null, status: "pending" });
      for (const docName of COMPLIANCE_DOCS) {
        const { data: existing } = await supabase.from("compliance_docs").select("id").eq("candidate_id", candidateId).eq("name", docName).limit(1);
        if (!existing || existing.length === 0) await supabase.from("compliance_docs").insert({ tenant_id: tenantId, candidate_id: candidateId, name: docName, employee_name: candidate.name, status: "pending", created_at: now, updated_at: now });
      }
      const registerLink = `${baseUrl}/candidate/register?candidateId=${candidateId}&tenantId=${tenantId}`;
      const portalLink = `${baseUrl}/candidate/portal?candidateId=${candidateId}&tenantId=${tenantId}`;
      await xavierNotify({ tenantId, candidateId, stage: "onboarding_triggered", candidateName: name });
      await xavierNotify({ tenantId, candidateId, stage: "compliance_initiated", candidateName: name });
      await addWorkflowEvent({ candidateId, tenantId, eventType: "ONBOARDING_TRIGGERED", actorId, actorName, meta: { onboardingId: onboarding?.id ?? null, registerLink, portalLink } });
      await logAudit({ action: "PROCEED_ONBOARDING", actorId, actorName, entityType: "candidate", entityId: candidateId, metadata: { tenantId } });
      await postToChannel(CANDIDATES_CHANNEL_ID, `Onboarding Triggered - ${name}`, tenantId, { registerLink, portalLink });
      return NextResponse.json({ success: true, action: "proceed_onboarding", candidateId, onboardingId: onboarding?.id ?? null, registerLink, portalLink });
    }
    if (action === "decline_candidate") {
      await supabase.from("candidates").update({ status: "rejected", decision: "REJECT", rejected_at: now, rejection_reason: declineReason ?? null, updated_at: now }).eq("id", candidateId);
      await xavierNotify({ tenantId, candidateId, stage: "auto_reject", candidateName: name, extra: declineReason });
      await addWorkflowEvent({ candidateId, tenantId, eventType: "CANDIDATE_DECLINED", actorId, actorName, meta: { reason: declineReason ?? null } });
      await logAudit({ action: "DECLINE_CANDIDATE", actorId, actorName, entityType: "candidate", entityId: candidateId, metadata: { tenantId, declineReason } });
      await postToChannel(CANDIDATES_CHANNEL_ID, `Candidate Declined - ${name}`, tenantId, { reason: declineReason ?? null });
      return NextResponse.json({ success: true, action: "decline_candidate", candidateId });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  },
  { schema: CandidateActionSchema, requireAuth: true, requireRole: ["admin","manager","operator","recruiter"], rateLimit: RATE_LIMITS.authenticated }
);
export async function GET() { return NextResponse.json({ route: "/api/recruitment/candidate-action", status: "ok", actions: ["proceed_onboarding","decline_candidate"] }); }