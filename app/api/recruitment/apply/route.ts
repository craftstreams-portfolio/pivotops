import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/withSecurity";
import { ApplySchema, ApplyInput } from "@/lib/security/schemas";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logger";
import { processApplication } from "@/lib/recruitment/scoring.engine";
import { xavierNotify } from "@/lib/recruitment/xavier.notifications";
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) { try { return await fn(); } catch (err) { if (i === retries - 1) throw err; await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i))); } }
  throw new Error("Max retries exceeded");
}
const CREDENTIAL_TYPES = [
  { key: "resume", name: "Resume / CV" },{ key: "nursing_license", name: "Nursing License" },{ key: "drivers_license", name: "Driver's License" },{ key: "flu_shot", name: "Flu Shot Record" },{ key: "covid_vaccine", name: "COVID-19 Vaccination" },{ key: "hep_b", name: "Hepatitis B Record" },{ key: "mmr", name: "MMR Vaccination" },{ key: "chest_xray", name: "Chest X-Ray" },{ key: "bls_cpr", name: "BLS / CPR Certification" },{ key: "drug_screening", name: "Drug Screening Results" },{ key: "background_check", name: "Background Check" },
];
async function postCandidateCard(admin: ReturnType<typeof getAdmin>, payload: { candidateId: string; tenantId: string; name: string; email: string; role: string; score: number; decision: string; summary: string; inviteUrl: string; }) {
  try {
    const { candidateId, tenantId, name, email, role, score, decision, summary, inviteUrl } = payload;
    const scoreEmoji = score >= 75 ? "??" : score >= 50 ? "??" : "??";
    const decisionLabel = decision === "auto_interview" ? "Auto-Routed to Interview" : decision === "manual_review" ? "Pending Review" : "Auto-Rejected";
    const content = [`?? **New Application --- Xavier AI**`,``,`**${name}**`,`?? ${email}`,``,`**Role:** ${role}`,`**Candidate ID:** \`${candidateId}\``,``,`${scoreEmoji} **Score: ${score}/100 --- ${decisionLabel}**`,``,`**Summary:**`,summary,``,`?? Registration: ${inviteUrl}`].join("\n");
    await admin.from("messages").insert({ channel_id: decision === "manual_review" ? "1da7f9fa-7f21-4557-bc59-7b0cb2a53b63" : "8a426d76-42a5-447b-a39b-7a9ea39f6a87", content, user_name: "Xavier AI", type: "system", meta: { type: "candidate_card", candidate_id: candidateId, name, email, role, score, decision, actions: [{ id: "schedule_interview", label: "?? Schedule Interview", style: "primary", action: "schedule_interview", candidate_id: candidateId },{ id: "send_offer", label: "?? Send Offer", style: "success", action: "send_offer", candidate_id: candidateId },{ id: "proceed_onboarding", label: "? Proceed to Onboarding", style: "success", action: "proceed_onboarding", candidate_id: candidateId },{ id: "decline_candidate", label: "? Decline", style: "danger", action: "decline_candidate", candidate_id: candidateId }] } });
    logger.info("Xavier card posted", { candidateId, decision, score });
  } catch (e) { logger.error("Xavier card failed", { error: e instanceof Error ? e.message : String(e) }); }
}
const handler = withSecurity<ApplyInput>(
  async (_req, { body }) => {
    const admin = getAdmin();
    const tenantId = body.tenant_id ?? "default";
    const { data: existing } = await admin.from("candidates").select("id, status").eq("email", body.email).eq("role", body.role).eq("tenant_id", tenantId).maybeSingle();
    if (existing) return NextResponse.json({ message: "Duplicate application", candidateId: existing.id }, { status: 409 });
    const { candidateId, result } = await withRetry(() => processApplication({ name: body.name, email: body.email, role: body.role, years_experience: body.years_experience ?? 0, phone: body.phone ?? "", linkedin_url: body.linkedin_url ?? "", current_employer: body.current_employer ?? "", cover_letter: body.cover_letter ?? "", resume_url: body.resume_url ?? null, resume_name: body.resume_name ?? null, tenant_id: tenantId }));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/candidate/register?candidateId=${candidateId}&tenantId=${tenantId}`;
    postCandidateCard(admin, { candidateId, tenantId, name: body.name, email: body.email, role: body.role, score: result.score, decision: result.decision, summary: result.summary, inviteUrl });
    const now = new Date().toISOString();
    for (const cred of CREDENTIAL_TYPES) {
      const { data: exists } = await admin.from("candidate_credentials").select("id").eq("candidate_id", candidateId).eq("doc_type", cred.key);
      if (!exists || exists.length === 0) await admin.from("candidate_credentials").insert({ candidate_id: candidateId, tenant_id: tenantId, doc_type: cred.key, name: cred.name, status: "pending", created_at: now, updated_at: now });
    }
    await xavierNotify({ tenantId, candidateId, stage: "application_received", candidateName: body.name, score: result.score });
    logger.info("Application processed", { candidateId, score: result.score, decision: result.decision });
    return NextResponse.json({ candidateId, score: result.score, decision: result.decision, inviteUrl }, { status: 201 });
  },
  { schema: ApplySchema, rateLimit: RATE_LIMITS.public, requireAuth: false }
);
export const POST = handler;
export async function GET() { return NextResponse.json({ status: "ok", service: "Xavier Apply Route v4 (Enterprise)", time: new Date().toISOString() }); }