import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

const MAX_REMINDERS = 3;
const REMIND_AFTER_HOURS = 6;
const PORTAL_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app") + "/candidate/portal";

export async function POST(req: Request) {
  const authHeader = (req as any).headers?.get?.("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  const cutoff = new Date(Date.now() - REMIND_AFTER_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  let processed = 0, emailed = 0, notified = 0;
  const errors: string[] = [];

  try {
    // Rejected docs still under the cap, not reminded within the last 6h
    const { data: due, error } = await admin
      .from("candidate_credentials")
      .select("id, candidate_id, tenant_id, name, doc_type, rejection_reason, reminder_count, last_reminded_at, status")
      .eq("status", "rejected")
      .lt("reminder_count", MAX_REMINDERS);

    if (error) throw new Error(error.message);

    const rows = (due ?? []).filter(
      (r: any) => !r.last_reminded_at || r.last_reminded_at < cutoff
    );

    // Resolve candidate emails once per candidate
    const candidateIds = Array.from(new Set(rows.map((r: any) => r.candidate_id).filter(Boolean)));
    const acctMap: Record<string, { email: string | null; name: string | null }> = {};
    if (candidateIds.length) {
      const { data: accts } = await admin
        .from("candidate_accounts")
        .select("candidate_id, email, full_name")
        .in("candidate_id", candidateIds);
      (accts ?? []).forEach((a: any) => { acctMap[a.candidate_id] = { email: a.email, name: a.full_name }; });
    }

    for (const r of rows) {
      processed++;
      const acct = acctMap[r.candidate_id] ?? { email: null, name: null };
      const docLabel = r.name || r.doc_type || "a document";
      const reason = r.rejection_reason ? ` Reason: ${r.rejection_reason}.` : "";
      const attempt = (r.reminder_count ?? 0) + 1;

      // 1) Email the candidate
      if (acct.email) {
        const { ok } = await sendEmail({
          to: acct.email,
          subject: `Action needed: re-upload ${docLabel}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
            <h2 style="margin:0 0 12px">Document needs re-uploading</h2>
            <p>Hi ${acct.name ?? "there"},</p>
            <p>Your document <strong>${docLabel}</strong> was not accepted and needs to be re-uploaded.${reason}</p>
            <p>Please log in to your candidate portal and upload a corrected version to continue your onboarding.</p>
            <p style="margin:24px 0">
              <a href="${PORTAL_URL}" style="background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open Candidate Portal</a>
            </p>
            <p style="color:#64748b;font-size:13px">Reminder ${attempt} of ${MAX_REMINDERS}. You will stop receiving these once the document is re-uploaded.</p>
          </div>`,
        });
        if (ok) emailed++;
      }

      // 2) Xavier in-app notification (service-role, correct tenant_id)
      const { error: notifErr } = await admin.from("xavier_notifications").insert({
        tenant_id:    r.tenant_id,
        candidate_id: r.candidate_id,
        stage:        "manual_review",
        message:      `Reminder ${attempt}/${MAX_REMINDERS}: ${acct.name ?? "Candidate"} still needs to re-upload "${docLabel}".`,
        type:         "warning",
        read:         false,
        created_at:   now,
      });
      if (!notifErr) notified++;
      else errors.push(`notif ${r.id}: ${notifErr.message}`);

      // 3) Bump the counter so the cap is enforced
      const { error: updErr } = await admin
        .from("candidate_credentials")
        .update({ reminder_count: attempt, last_reminded_at: now })
        .eq("id", r.id);
      if (updErr) errors.push(`update ${r.id}: ${updErr.message}`);
    }

    return NextResponse.json({ ok: true, processed, emailed, notified, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, processed, emailed, notified, errors }, { status: 500 });
  }
}