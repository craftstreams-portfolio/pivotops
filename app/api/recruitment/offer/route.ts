import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { xavierNotify } from "@/lib/recruitment/xavier.notifications";
import { createOnboardingUser } from "@/lib/onboarding/onboarding.engine";
import { z } from "zod";
function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }
function extractMessage(e: unknown): string { if (!e) return "Unknown"; if (typeof e === "string") return e; if (e instanceof Error) return e.message; return JSON.stringify(e); }
const COMPLIANCE_DOCS = ["Resume / CV","Nursing License","Driver's License","Flu Shot Record","COVID-19 Vaccination","Hepatitis B Record","MMR Vaccination","Chest X-Ray","BLS / CPR Certification","Drug Screening Results","Background Check"];
const OfferResponseSchema = z.object({ offerId: z.string().uuid(), action: z.enum(["accept","decline"]), candidateId: z.string().uuid(), declineReason: z.string().max(1000).optional(), token: z.string().min(10) });
type OfferResponseInput = z.infer<typeof OfferResponseSchema>;
async function handleOfferResponse(offerId: string, action: string, candidateId: string, declineReason?: string) {
  const db = getAdmin();
  const { data: offer, error: offerErr } = await db.from("offer_letters").select("*").eq("id", offerId).single();
  if (offerErr || !offer) throw new Error("Offer not found");
  const { data: candidate, error: candErr } = await db.from("candidates").select("*").eq("id", candidateId).single();
  if (candErr || !candidate) throw new Error("Candidate not found");
  if (offer.status !== "sent") throw new Error("This offer has already been responded to");
  if (offer.candidate_id !== candidateId) throw new Error("Candidate ID does not match this offer");
  const tenantId = offer.tenant_id ?? "default";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (action === "accept") {
    await db.from("offer_letters").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offerId);
    await db.from("candidates").update({ status: "hired", decision: "STRONG_HIRE", offer_accepted_at: new Date().toISOString(), hired_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", candidateId);
    await xavierNotify({ tenantId, candidateId, stage: "offer_accepted", candidateName: candidate.name });
    const onboardingUser = await createOnboardingUser(db, { candidate_id: candidateId, name: candidate.name, email: candidate.email, department: offer.department ?? null, status: "pending" });
    await xavierNotify({ tenantId, candidateId, stage: "onboarding_triggered", candidateName: candidate.name });
    for (const docName of COMPLIANCE_DOCS) {
      const { data: existing } = await db.from("compliance_docs").select("id").eq("candidate_id", candidateId).eq("name", docName).limit(1);
      if (!existing || existing.length === 0) await db.from("compliance_docs").insert({ name: docName, employee_name: candidate.name, candidate_id: candidateId, tenant_id: tenantId, status: "pending", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    await xavierNotify({ tenantId, candidateId, stage: "compliance_initiated", candidateName: candidate.name });
    const registerLink = `${baseUrl}/candidate/register?candidateId=${candidateId}&tenantId=${tenantId}`;
    return { success: true, action: "accepted", onboardingId: onboardingUser?.id ?? null, registerLink };
  }
  await db.from("offer_letters").update({ status: "declined", decline_reason: declineReason ?? null, responded_at: new Date().toISOString() }).eq("id", offerId);
  await db.from("candidates").update({ status: "rejected", decision: "REJECT", offer_declined_at: new Date().toISOString(), decline_reason: declineReason ?? null, updated_at: new Date().toISOString() }).eq("id", candidateId);
  await xavierNotify({ tenantId, candidateId, stage: "offer_declined", candidateName: candidate.name, extra: declineReason });
  return { success: true, action: "declined" };
}
function renderPage(title: string, message: string, variant: "success"|"info"|"error"): string {
  const c = { success: { border: "#16a34a", text: "#4ade80" }, info: { border: "#3b82f6", text: "#60a5fa" }, error: { border: "#dc2626", text: "#f87171" } }[variant];
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title} - PivotOps</title><style>body{font-family:sans-serif;background:#080810;color:#e4e4f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{max-width:480px;padding:2rem;border:1px solid ${c.border};border-radius:8px}h1{color:${c.text}}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const offerId = searchParams.get("offerId") ?? "";
  const action = searchParams.get("action") ?? "";
  const candidateId = searchParams.get("candidateId") ?? "";
  const token = searchParams.get("token") ?? "";
  if (!offerId || !action || !candidateId || !token) return new Response(renderPage("Invalid Link", "This offer link is missing required parameters.", "error"), { headers: { "Content-Type": "text/html" } });
  const db = getAdmin();
  const { data: offer } = await db.from("offer_letters").select("offer_token").eq("id", offerId).single();
  if (!offer || offer.offer_token !== token) return new Response(renderPage("Invalid Link", "This offer link is invalid or has expired.", "error"), { headers: { "Content-Type": "text/html" } });
  try {
    await handleOfferResponse(offerId, action, candidateId);
    const title = action === "accept" ? "Offer Accepted!" : "Offer Declined";
    const message = action === "accept" ? "Thank you for accepting. Your onboarding has been initiated." : "We have recorded your decision. Thank you for your time.";
    return new Response(renderPage(title, message, action === "accept" ? "success" : "info"), { headers: { "Content-Type": "text/html" } });
  } catch (err) { return new Response(renderPage("Something went wrong", extractMessage(err), "error"), { headers: { "Content-Type": "text/html" } }); }
}
export const POST = withSecurity<OfferResponseInput>(
  async (_req, { body }) => {
    const db = getAdmin();
    const { data: offer } = await db.from("offer_letters").select("offer_token, candidate_id").eq("id", body.offerId).single();
    if (!offer || offer.offer_token !== body.token) return NextResponse.json({ error: "Invalid or expired offer token." }, { status: 403 });
    if (offer.candidate_id !== body.candidateId) return NextResponse.json({ error: "Candidate ID mismatch." }, { status: 403 });
    const result = await handleOfferResponse(body.offerId, body.action, body.candidateId, body.declineReason);
    return NextResponse.json(result);
  },
  { schema: OfferResponseSchema, requireAuth: false, rateLimit: RATE_LIMITS.public }
);