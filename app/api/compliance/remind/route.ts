import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
function extractMessage(e: unknown): string { if (!e) return "Unknown"; if (typeof e === "string") return e; if (e instanceof Error) return e.message; return JSON.stringify(e); }
export const POST = withSecurity(
  async (_req, { auth }) => {
    const tenantId = auth!.tenantId;
    const { data: rejectedDocs, error: docsErr } = await supabase.from("compliance_docs").select("*").eq("status", "rejected").eq("tenant_id", tenantId);
    if (docsErr) throw new Error(`Failed to fetch rejected docs: ${extractMessage(docsErr)}`);
    if (!rejectedDocs || rejectedDocs.length === 0) return NextResponse.json({ message: "No rejected documents.", count: 0 });
    const byCandidateId: Record<string, typeof rejectedDocs> = {};
    rejectedDocs.forEach((doc) => { if (!doc.candidate_id) return; if (!byCandidateId[doc.candidate_id]) byCandidateId[doc.candidate_id] = []; byCandidateId[doc.candidate_id].push(doc); });
    let reminded = 0;
    for (const [candidateId, docs] of Object.entries(byCandidateId)) {
      const lastReminder = docs[0]?.last_reminder_at ? new Date(docs[0].last_reminder_at) : null;
      if (lastReminder && lastReminder > new Date(Date.now() - 6 * 60 * 60 * 1000)) continue;
      const { data: account } = await supabase.from("candidate_accounts").select("full_name, email, tenant_id").eq("candidate_id", candidateId).single();
      const candidateName = account?.full_name ?? "Candidate";
      const rejectedNames = docs.map((d) => d.name).join(", ");
      const reminderCount = (docs[0]?.reminder_count ?? 0) + 1;
      const urgency = reminderCount >= 4 ? "URGENT" : reminderCount >= 2 ? "Reminder" : "Notice";
      const message = `Xavier AI - ${urgency} - ${candidateName} has ${docs.length} rejected document${docs.length > 1 ? "s" : ""} requiring re-upload: ${rejectedNames}. Reminder #${reminderCount}.`;
      await supabase.from("xavier_notifications").insert({ tenant_id: tenantId, candidate_id: candidateId, stage: "auto_reject", message, type: reminderCount >= 4 ? "alert" : "warning", read: false, created_at: new Date().toISOString() });
      logger.info("Compliance reminder sent", { candidateId, reminderCount, tenantId });
      const now = new Date().toISOString();
      await supabase.from("compliance_docs").update({ last_reminder_at: now, reminder_count: reminderCount, updated_at: now }).eq("candidate_id", candidateId).eq("status", "rejected").eq("tenant_id", tenantId);
      reminded++;
    }
    return NextResponse.json({ message: `Xavier AI sent ${reminded} reminder${reminded !== 1 ? "s" : ""}.`, count: reminded, total: Object.keys(byCandidateId).length });
  },
  { requireAuth: true, requireRole: ["admin","manager","operator"], rateLimit: RATE_LIMITS.authenticated }
);
export async function GET() { return NextResponse.json({ message: "Xavier AI Compliance Reminder Engine", cron: "0 */6 * * *" }); }