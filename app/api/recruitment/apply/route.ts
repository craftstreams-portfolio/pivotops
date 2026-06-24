import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/withSecurity";
import { ApplySchema, ApplyInput } from "@/lib/security/schemas";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logger";
import { processApplication } from "@/lib/recruitment/scoring.engine";
import { xavierNotify, getOrCreateChannel } from "@/lib/recruitment/xavier.notifications";
import { sendEmail } from "@/lib/email";
import { qualificationSummaryEmail } from "@/lib/recruitment/email-templates";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

// The candidates table stores the AI decision under a separate HR-facing
// label (decision: STRONG_HIRE / REVIEW / REJECT), distinct from the
// internal scoring vocabulary (auto_interview / manual_review / auto_reject)
// used everywhere else in this route and in xavier.notifications.ts. This
// maps the stored label back to the internal vocabulary for resubmissions.
const DECISION_DB_TO_INTERNAL: Record<string, string> = {
  STRONG_HIRE: "auto_interview",
  REVIEW: "manual_review",
  REJECT: "auto_reject",
};

const HEALTHCARE_CREDENTIAL_TYPES = [
  { key: "resume", name: "Resume / CV" },
  { key: "nursing_license", name: "Nursing License" },
  { key: "drivers_license", name: "Driver's License" },
  { key: "flu_shot", name: "Flu Shot Record" },
  { key: "covid_vaccine", name: "COVID-19 Vaccination" },
  { key: "hep_b", name: "Hepatitis B Record" },
  { key: "mmr", name: "MMR Vaccination" },
  { key: "chest_xray", name: "Chest X-Ray" },
  { key: "bls_cpr", name: "BLS / CPR Certification" },
  { key: "drug_screening", name: "Drug Screening Results" },
  { key: "background_check", name: "Background Check" },
];

const GENERAL_CREDENTIAL_TYPES = [
  { key: "resume", name: "Resume / CV" },
  { key: "license_certification", name: "License / Certification" },
];

async function getOrCreateChannelAdmin(
  admin: ReturnType<typeof getAdmin>,
  tenantId: string,
  name: string
): Promise<string> {
  const { data: existing } = await admin
    .from("channels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from("channels")
    .insert({ name, tenant_id: tenantId, type: "channel", created_at: new Date().toISOString() })
    .select("id")
    .single();
  if (!error && created?.id) return created.id;

  // Race fallback
  const { data: retry } = await admin
    .from("channels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .maybeSingle();
  if (retry?.id) return retry.id;

  throw new Error("Unable to resolve channel " + name + ": " + (error?.message ?? "unknown"));
}

async function postCandidateCard(
  admin: ReturnType<typeof getAdmin>,
  payload: {
    candidateId: string; tenantId: string; name: string; email: string; role: string;
    score: number; decision: string; summary: string; inviteUrl: string;
  }
): Promise<boolean> {
  const { candidateId, tenantId, name, email, role, score, decision, summary, inviteUrl } = payload;
  const decisionLabel =
    decision === "auto_interview" ? "Auto-Routed to Interview" :
    decision === "manual_review" ? "Pending Review" : "Auto-Rejected";
  const content = [
    `New Application - Xavier AI`, ``, `${name}`, `${email}`, ``,
    `Role: ${role}`, `Candidate ID: ${candidateId}`, ``,
    `Score: ${score}/100 - ${decisionLabel}`, ``, `Summary:`, summary, ``,
    `Registration (internal use): ${inviteUrl}`,
  ].join("\n");

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const channelId = decision === "manual_review"
        ? await getOrCreateChannelAdmin(admin, tenantId, "Recruitment Review")
        : await getOrCreateChannelAdmin(admin, tenantId, "Candidates");

      const { error } = await admin.from("messages").insert({
        channel_id: channelId,
        tenant_id: tenantId,
        content,
        user_name: "Xavier AI",
        type: "system",
        meta: {
          type: "candidate_card",
          candidate_id: candidateId, name, email, role, score, decision,
          actions: [
            { id: "schedule_interview", label: "Schedule Interview", style: "primary", action: "schedule_interview", candidate_id: candidateId },
            { id: "send_offer", label: "Send Offer", style: "success", action: "send_offer", candidate_id: candidateId },
            { id: "proceed_onboarding", label: "Proceed to Onboarding", style: "success", action: "proceed_onboarding", candidate_id: candidateId },
            { id: "decline_candidate", label: "Decline", style: "danger", action: "decline_candidate", candidate_id: candidateId },
          ],
        },
      });

      if (error) throw new Error(error.message);

      logger.info("Xavier card posted", { candidateId, decision, score, attempt });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === maxAttempts) {
        logger.error("Xavier card failed after retries", { candidateId, error: msg, attempts: attempt });
        return false;
      }
      await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
    }
  }
  return false;
}

export const POST = withSecurity<ApplyInput>(
  async (_req, { body }) => {
    const admin = getAdmin();
    if (!body.tenant_id) {
      return NextResponse.json({ error: "Missing tenant_id" }, { status: 400 });
    }
    const tenantId = body.tenant_id;
    const roleCategory = (body as any).role_category === "general" ? "general" : "healthcare";

    const { data: existingRows } = await admin
      .from("candidates")
      .select("id, ai_score, decision, ai_summary")
      .eq("email", body.email.trim().toLowerCase())
      .eq("tenant_id", tenantId)
      .not("status", "eq", "rejected")
      .limit(1);
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    let candidateId: string;
    let result: { score: number; decision: string; summary: string };

    if (existing) {
      candidateId = existing.id;
      result = {
        score: existing.ai_score ?? 0,
        decision: DECISION_DB_TO_INTERNAL[existing.decision ?? ""] ?? "manual_review",
        summary: existing.ai_summary ?? "",
      };

      await admin
        .from("candidates")
        .update({
          name: body.name,
          phone: body.phone ?? "",
          linkedin_url: body.linkedin_url ?? "",
          current_employer: body.current_employer ?? "",
          cover_letter: body.cover_letter ?? "",
          resume_url: body.resume_url ?? null,
          resume_name: body.resume_name ?? null,
          years_experience: body.years_experience ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId);
    } else {
      let applyResult: Awaited<ReturnType<typeof processApplication>>;
      try {
        applyResult = await withRetry(() =>
          processApplication({
            name: body.name,
            email: body.email,
            role: body.role,
            years_experience: body.years_experience ?? 0,
            phone: body.phone ?? "",
            linkedin_url: body.linkedin_url ?? "",
            current_employer: body.current_employer ?? "",
            cover_letter: body.cover_letter ?? "",
            resume_url: body.resume_url ?? null,
            resume_name: body.resume_name ?? null,
            tenant_id: tenantId,
          })
        );
      } catch (applyErr) {
        const applyMsg = applyErr instanceof Error ? applyErr.message : String(applyErr);
        if (applyMsg.toLowerCase().includes("already exists") || applyMsg.toLowerCase().includes("duplicate") || applyMsg.toLowerCase().includes("active application")) {
          return NextResponse.json({ error: applyMsg }, { status: 409 });
        }
        throw applyErr;
      }
      candidateId = applyResult.candidateId;
      result = applyResult.result;
    }

    await admin
      .from("candidates")
      .update({
        role_category: roleCategory,
        applied_timezone: (body as any).applied_timezone ?? null,
      })
      .eq("id", candidateId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/candidate/register?candidateId=${candidateId}&tenantId=${tenantId}`;

    const cardPosted = await postCandidateCard(admin, {
      candidateId, tenantId, name: body.name, email: body.email, role: body.role,
      score: result.score, decision: result.decision, summary: result.summary, inviteUrl,
    });

    const credentialTypesToSeed = roleCategory === "general" ? GENERAL_CREDENTIAL_TYPES : HEALTHCARE_CREDENTIAL_TYPES;
    const now = new Date().toISOString();
    for (const cred of credentialTypesToSeed) {
      const { data: exists } = await admin
        .from("candidate_credentials")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("doc_type", cred.key);
      if (!exists || exists.length === 0) {
        await admin.from("candidate_credentials").insert({
          candidate_id: candidateId, tenant_id: tenantId, doc_type: cred.key,
          name: cred.name, status: "pending", created_at: now, updated_at: now,
        });
      }
    }

    if (result.decision === "auto_interview") {
      const { data: tenantRow } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
      const { subject, html } = qualificationSummaryEmail({
        candidateName: body.name,
        roleName: body.role,
        score: result.score,
        decision: result.decision,
        tenantName: tenantRow?.name ?? "the team",
      });
      const emailResult = await sendEmail({ to: body.email, subject, html });
      if (!emailResult.ok) {
        logger.error("Candidate summary email failed", { candidateId, error: emailResult.error });
      }
    }

    await xavierNotify({ tenantId, candidateId, stage: "application_received", candidateName: body.name, score: result.score });
    logger.info("Application processed", { candidateId, score: result.score, decision: result.decision, roleCategory, cardPosted });

    return NextResponse.json({ candidateId, score: result.score, decision: result.decision, cardPosted });
  },
  { schema: ApplySchema, rateLimit: RATE_LIMITS.public, requireAuth: false }
);

export async function GET() {
  return NextResponse.json({ status: "ok", service: "Xavier Apply Route v7 (Enterprise)", time: new Date().toISOString() });
}