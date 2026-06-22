import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createOnboardingUser } from "@/lib/onboarding/onboarding.engine";
import { xavierNotify, getOrCreateChannel } from "@/lib/recruitment/xavier.notifications";
import { logAudit } from "@/lib/audit";
import { addWorkflowEvent } from "@/lib/workflow";
import { sendEmail } from "@/lib/email";
import { offerLetterEmail, interviewScheduledEmail } from "@/lib/recruitment/email-templates";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const CandidateActionSchema = z.object({
  action: z.enum(["proceed_onboarding", "decline_candidate", "schedule_interview", "send_offer"]),
  candidateId: z.string().uuid(),
  actorName: z.string().max(255).optional().default("Recruiter"),
  declineReason: z.string().max(1000).optional(),
  messageId: z.string().uuid().optional(),
  startDate: z.string().max(100).optional(),
  offerNotes: z.string().max(2000).optional(),
});
type CandidateActionInput = z.infer<typeof CandidateActionSchema>;

const COMPLIANCE_DOCS = ["Resume / CV","Nursing License","Driver's License","Flu Shot Record","COVID-19 Vaccination","Hepatitis B Record","MMR Vaccination","Chest X-Ray","BLS / CPR Certification","Drug Screening Results","Background Check"];

async function postToChannel(admin: ReturnType<typeof getAdmin>, channelId: string, content: string, tenantId: string, meta?: Record<string, unknown>) {
  await admin.from("messages").insert({ channel_id: channelId, content, user_id: "00000000-0000-0000-0000-000000000000", user_name: "Xavier AI", tenant_id: tenantId, type: "system", retracted: false, reactions: {}, meta: meta ?? null, created_at: new Date().toISOString() });
}

async function safeSideEffect(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error("[candidate-action] non-critical side effect failed: " + label, err);
  }
}

export const POST = withSecurity<CandidateActionInput>(
  async (_req, { auth, body }) => {
    const admin = getAdmin();
    const tenantId = auth!.tenantId;
    const actorId = auth!.userId;
    const { action, candidateId, actorName, declineReason, messageId, startDate, offerNotes } = body;
    const { data: candidate, error } = await admin.from("candidates").select("*").eq("id", candidateId).eq("tenant_id", tenantId).single();
    if (error || !candidate) return NextResponse.json({ error: "Candidate not found in your tenant." }, { status: 404 });
    const now = new Date().toISOString();
    const name = candidate.name ?? "Candidate";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    let candidatesChannelId: string | null = null;
    try {
      candidatesChannelId = await getOrCreateChannel(tenantId, "Candidates");
    } catch (err) {
      console.error("[candidate-action] failed to resolve Candidates channel", err);
    }

    if (messageId) {
      await safeSideEffect("update message meta", async () => {
        const { data: msg } = await admin.from("messages").select("meta").eq("id", messageId).single();
        if (msg) await admin.from("messages").update({ meta: { ...(msg.meta ?? {}), actioned: true, actioned_by: actorName, actioned_at: now, action, candidate_id: candidateId } }).eq("id", messageId);
      });
    }

    if (action === "proceed_onboarding") {
      const { error: updateError } = await admin.from("candidates").update({ status: "hired", decision: "STRONG_HIRE", offer_accepted_at: now, hired_at: now, updated_at: now }).eq("id", candidateId);
      if (updateError) return NextResponse.json({ error: "Failed to update candidate status: " + updateError.message }, { status: 500 });

      let onboarding;
      try {
        onboarding = await createOnboardingUser(admin, { candidate_id: candidateId, name: candidate.name, email: candidate.email, department: candidate.department ?? null, status: "pending" });
      } catch (err) {
        console.error("[candidate-action] createOnboardingUser failed", err);
        return NextResponse.json({ error: "Failed to create onboarding record: " + (err instanceof Error ? err.message : "Unknown error") }, { status: 500 });
      }

      for (const docName of COMPLIANCE_DOCS) {
        await safeSideEffect("compliance_docs:" + docName, async () => {
          const { data: existing } = await admin.from("compliance_docs").select("id").eq("candidate_id", candidateId).eq("name", docName).limit(1);
          if (!existing || existing.length === 0) await admin.from("compliance_docs").insert({ tenant_id: tenantId, candidate_id: candidateId, name: docName, employee_name: candidate.name, status: "pending", created_at: now, updated_at: now });
        });
      }

      const registerLink = baseUrl + "/candidate/register?candidateId=" + candidateId + "&tenantId=" + tenantId;
      const portalLink = baseUrl + "/candidate/portal?candidateId=" + candidateId + "&tenantId=" + tenantId;

      await safeSideEffect("xavierNotify:onboarding_triggered", () => xavierNotify({ tenantId, candidateId, stage: "onboarding_triggered", candidateName: name }));
      await safeSideEffect("xavierNotify:compliance_initiated", () => xavierNotify({ tenantId, candidateId, stage: "compliance_initiated", candidateName: name }));
      await safeSideEffect("addWorkflowEvent", () => addWorkflowEvent({ candidateId, tenantId, eventType: "ONBOARDING_TRIGGERED", actorId, actorName, meta: { onboardingId: onboarding?.id ?? null, registerLink, portalLink } }));
      await safeSideEffect("logAudit", () => logAudit({ action: "PROCEED_ONBOARDING", actorId, actorName, entityType: "candidate", entityId: candidateId, metadata: { tenantId } }));
      if (candidatesChannelId) {
        await safeSideEffect("postToChannel", () => postToChannel(admin, candidatesChannelId!, "Onboarding Triggered - " + name, tenantId, { registerLink, portalLink }));
      }

      return NextResponse.json({ success: true, action: "proceed_onboarding", candidateId, onboardingId: onboarding?.id ?? null, registerLink, portalLink });
    }

    if (action === "decline_candidate") {
      const { error: updateError } = await admin.from("candidates").update({ status: "rejected", decision: "REJECT", rejected_at: now, rejection_reason: declineReason ?? null, updated_at: now }).eq("id", candidateId);
      if (updateError) return NextResponse.json({ error: "Failed to update candidate status: " + updateError.message }, { status: 500 });

      await safeSideEffect("xavierNotify:auto_reject", () => xavierNotify({ tenantId, candidateId, stage: "auto_reject", candidateName: name, extra: declineReason }));
      await safeSideEffect("addWorkflowEvent", () => addWorkflowEvent({ candidateId, tenantId, eventType: "CANDIDATE_DECLINED", actorId, actorName, meta: { reason: declineReason ?? null } }));
      await safeSideEffect("logAudit", () => logAudit({ action: "DECLINE_CANDIDATE", actorId, actorName, entityType: "candidate", entityId: candidateId, metadata: { tenantId, declineReason } }));
      if (candidatesChannelId) {
        await safeSideEffect("postToChannel", () => postToChannel(admin, candidatesChannelId!, "Candidate Declined - " + name, tenantId, { reason: declineReason ?? null }));
      }

      return NextResponse.json({ success: true, action: "decline_candidate", candidateId });
    }

    if (action === "schedule_interview") {
      const receivedAt = new Date(candidate.created_at ?? now);
      const scheduledAt = new Date(receivedAt.getTime() + 72 * 60 * 60 * 1000);
      const tz = candidate.applied_timezone || "UTC";
      let localTime: string;
      try {
        localTime = scheduledAt.toLocaleString("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short" });
      } catch {
        localTime = scheduledAt.toISOString();
      }

      const interviewToken = crypto.randomUUID();
      const { error: updateError } = await admin.from("candidates").update({ interview_scheduled_at: scheduledAt.toISOString(), interview_token: interviewToken, updated_at: now }).eq("id", candidateId);
      if (updateError) return NextResponse.json({ error: "Failed to update candidate status: " + updateError.message }, { status: 500 });

      const interviewBase = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/api/recruitment/interview-confirm";
      const confirmUrl = interviewBase + "?token=" + interviewToken;
      if (candidate.email) {
        const { data: tenantRow2 } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
        const { subject: iSubject, html: iHtml } = interviewScheduledEmail({
          candidateName: name,
          roleName: candidate.role ?? "the role",
          tenantName: tenantRow2?.name ?? "the team",
          scheduledTime: localTime,
          timezone: tz,
          confirmUrl,
        });
        await safeSideEffect("sendInterviewEmail", () => sendEmail({ to: candidate.email, subject: iSubject, html: iHtml }));
      }

      await safeSideEffect("xavierNotify:interview_scheduled", () => xavierNotify({ tenantId, candidateId, stage: "interview_scheduled", candidateName: name, extra: localTime + " (" + tz + ")" }));
      await safeSideEffect("addWorkflowEvent", () => addWorkflowEvent({ candidateId, tenantId, eventType: "INTERVIEW_SCHEDULED", actorId, actorName, meta: { scheduledAt: scheduledAt.toISOString(), timezone: tz, localTime } }));
      await safeSideEffect("logAudit", () => logAudit({ action: "SCHEDULE_INTERVIEW", actorId, actorName, entityType: "candidate", entityId: candidateId, metadata: { tenantId, scheduledAt: scheduledAt.toISOString() } }));
      if (candidatesChannelId) {
        await safeSideEffect("postToChannel", () => postToChannel(admin, candidatesChannelId!, "Interview Scheduled - " + name + " - " + localTime + " (" + tz + ")", tenantId, { scheduledAt: scheduledAt.toISOString(), timezone: tz }));
      }

      return NextResponse.json({ success: true, action: "schedule_interview", candidateId, scheduledAt: scheduledAt.toISOString(), localTime, timezone: tz });
    }

    if (action === "send_offer") {
      if (!candidate.email) {
        return NextResponse.json({ error: "Candidate has no email on file." }, { status: 400 });
      }

      const { data: tenantRow } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
      const tenantName = tenantRow?.name ?? "the team";

      const offerToken = crypto.randomUUID();
      await admin.from("candidates").update({ offer_token: offerToken }).eq("id", candidateId);
      const offerBase = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/api/recruitment/offer-response";
      const acceptUrl = offerBase + "?token=" + offerToken + "&action=accept";
      const declineUrl = offerBase + "?token=" + offerToken + "&action=decline";
      const { subject, html } = offerLetterEmail({
        candidateName: name,
        roleName: candidate.role ?? "the role",
        tenantName,
        startDate,
        additionalNotes: offerNotes,
        acceptUrl,
        declineUrl,
      });
      const emailResult = await sendEmail({ to: candidate.email, subject, html });

      const { error: updateError } = await admin.from("candidates").update({ offer_sent_at: now, offer_status: "sent", updated_at: now }).eq("id", candidateId);
      if (updateError) return NextResponse.json({ error: "Failed to update candidate status: " + updateError.message }, { status: 500 });

      await safeSideEffect("xavierNotify:offer_sent", () => xavierNotify({ tenantId, candidateId, stage: "offer_sent", candidateName: name }));
      await safeSideEffect("addWorkflowEvent", () => addWorkflowEvent({ candidateId, tenantId, eventType: "OFFER_SENT", actorId, actorName, meta: { startDate: startDate ?? null, emailSent: emailResult.ok } }));
      await safeSideEffect("logAudit", () => logAudit({ action: "SEND_OFFER", actorId, actorName, entityType: "candidate", entityId: candidateId, metadata: { tenantId, startDate, emailSent: emailResult.ok } }));
      if (candidatesChannelId) {
        await safeSideEffect("postToChannel", () => postToChannel(admin, candidatesChannelId!, "Offer Sent - " + name + (emailResult.ok ? "" : " (email delivery failed - check RESEND_API_KEY)"), tenantId, { emailSent: emailResult.ok }));
      }

      return NextResponse.json({ success: true, action: "send_offer", candidateId, emailSent: emailResult.ok });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  },
  { schema: CandidateActionSchema, requireAuth: true, requireRole: ["admin","manager","operator","recruiter"], rateLimit: RATE_LIMITS.authenticated }
);

export async function GET() { return NextResponse.json({ route: "/api/recruitment/candidate-action", status: "ok", actions: ["proceed_onboarding","decline_candidate","schedule_interview","send_offer"] }); }