import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const TYPE_LABEL: Record<string, string> = {
  annual: "Annual Leave", casual: "Casual Leave", sick: "Sick Leave",
  maternity: "Maternity Leave", emergency: "Emergency Leave",
  study: "Study Leave", time_off: "Time Off",
};

function fmt(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function shell(inner: string): string {
  return `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#0d1117">${inner}
    <p style="font-size:11px;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
      Sent by PivotOps · Workforce Operations</p></div>`;
}

/**
 * Leave notifications.
 *  submitted → email every admin/manager: a request awaits approval
 *  approved  → email ALL tenant members: who's on leave, the (possibly trimmed)
 *              dates, and who is covering
 *  declined  → email ONLY the requester, with the manager's reason
 */
export async function POST(req: NextRequest) {
  try {
    const { requestId, event } = await req.json();
    if (!requestId || !event) {
      return NextResponse.json({ error: "Missing requestId or event" }, { status: 400 });
    }

    const admin = getAdmin();

    const { data: reqRow } = await admin
      .from("leave_requests").select("*").eq("id", requestId).single();
    if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const tenantId = reqRow.tenant_id;
    const typeLabel = TYPE_LABEL[reqRow.leave_type] ?? reqRow.leave_type;

    // Everyone in the tenant (for the roster + name lookups)
    const { data: people } = await admin
      .from("profiles").select("id, full_name, email, role").eq("tenant_id", tenantId);
    const roster = people ?? [];
    const nameOf = (id: string | null) =>
      roster.find(p => p.id === id)?.full_name
      ?? roster.find(p => p.id === id)?.email ?? "a team member";

    const requester = roster.find(p => p.id === reqRow.user_id);
    const requesterName = requester?.full_name ?? requester?.email ?? "A team member";

    const { data: orgRow } = await admin
      .from("tenants").select("org_name").eq("id", tenantId).maybeSingle();
    const org = orgRow?.org_name ?? "your organization";

    // ── SUBMITTED → managers only ──
    if (event === "submitted") {
      const managers = roster.filter(p => (p.role === "admin" || p.role === "manager") && p.email);
      if (managers.length > 0) {
        await sendEmail({
          to: managers.map(m => m.email!) as string[],
          subject: `Leave request from ${requesterName} — approval needed`,
          from: EMAIL_SENDERS.notifications,
          html: shell(`
            <h2 style="color:#06070D">Leave request awaiting your approval</h2>
            <p><strong>${requesterName}</strong> has requested <strong>${typeLabel}</strong>.</p>
            <p style="margin:4px 0"><strong>Dates:</strong> ${fmt(reqRow.start_date)}${reqRow.end_date !== reqRow.start_date ? ` → ${fmt(reqRow.end_date)}` : ""}</p>
            ${reqRow.note ? `<p style="background:#f5f6f7;border-radius:8px;padding:10px;font-size:13px">${reqRow.note}</p>` : ""}
            <p style="font-size:13px;color:#555">Review it under Employee Profiles → Leave / Time Off → Approvals.</p>`),
        });
      }
      return NextResponse.json({ ok: true, notified: managers.length });
    }

    // ── APPROVED → whole tenant ──
    if (event === "approved") {
      const start = fmt(reqRow.approved_start ?? reqRow.start_date);
      const end   = reqRow.approved_end ?? reqRow.end_date;
      const range = end && end !== (reqRow.approved_start ?? reqRow.start_date)
        ? `${start} → ${fmt(end)}` : start;
      const coverName = reqRow.cover_user_id ? nameOf(reqRow.cover_user_id) : null;

      const everyone = roster.filter(p => p.email).map(p => p.email!) as string[];
      if (everyone.length > 0) {
        await sendEmail({
          to: everyone,
          subject: `${requesterName} will be on ${typeLabel} (${start})`,
          from: EMAIL_SENDERS.notifications,
          html: shell(`
            <h2 style="color:#06070D">Team leave notice</h2>
            <p>Hello team at <strong>${org}</strong>,</p>
            <p><strong>${requesterName}</strong> will be on <strong>${typeLabel}</strong> during:</p>
            <p style="font-size:15px;font-weight:700;margin:6px 0">${range}</p>
            ${coverName
              ? `<p style="background:#e9fbf7;border:1px solid #b8efe4;border-radius:8px;padding:12px">
                   During this period, <strong>${coverName}</strong> is covering.
                   Please direct anything that would normally go to ${requesterName} to ${coverName}.</p>`
              : `<p style="color:#555;font-size:13px">No cover has been assigned for this period.</p>`}
            <p style="font-size:12px;color:#888">This is an automated notice so the team can plan around the absence.</p>`),
        });
      }
      return NextResponse.json({ ok: true, notified: everyone.length, cover: coverName });
    }

    // ── DECLINED → requester only ──
    if (event === "declined") {
      if (requester?.email) {
        await sendEmail({
          to: requester.email,
          subject: `Your ${typeLabel} request was declined`,
          from: EMAIL_SENDERS.notifications,
          html: shell(`
            <h2 style="color:#06070D">Leave request declined</h2>
            <p>Hello${requester.full_name ? " " + requester.full_name : ""},</p>
            <p>Your request for <strong>${typeLabel}</strong> (${fmt(reqRow.start_date)}${reqRow.end_date !== reqRow.start_date ? ` → ${fmt(reqRow.end_date)}` : ""}) was not approved.</p>
            ${reqRow.decline_reason
              ? `<p style="background:#fdeff0;border:1px solid #f6c9cd;border-radius:8px;padding:12px">
                   <strong>Reason:</strong> ${reqRow.decline_reason}</p>`
              : ""}
            <p style="font-size:13px;color:#555">If you have questions, please speak with your manager directly.</p>`),
        });
      }
      // Deliberately no notice to anyone else.
      return NextResponse.json({ ok: true, notified: requester?.email ? 1 : 0 });
    }

    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  } catch (e: any) {
    console.error("[leave/notify]", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}