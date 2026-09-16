import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

// Runs hourly. birthdays_due_now() returns only the people whose LOCAL time has
// just reached their tenant's configured send hour, so a daily UTC job cannot
// replace this - it would fire at one global moment regardless of where the
// employee is.
//
// Duplicate protection is the partial unique index on birthday_messages, not
// logic in here: a retry, an overlapping invocation or a manual send that
// already happened all collide at the database and are skipped.

export const maxDuration = 60;

export async function POST(req: Request) {
  const authHeader = (req as any).headers?.get?.("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  const now = new Date().toISOString();

  let due = 0, created = 0, sent = 0, queued = 0, skipped = 0, failed = 0;
  const errors: string[] = [];

  try {
    const { data: rows, error } = await admin.rpc("birthdays_due_now", { p_now: now });
    if (error) throw new Error(error.message);

    due = (rows ?? []).length;

    for (const r of rows ?? []) {
      if (!r.template_id) { skipped++; continue; }

      // Render with the service role. birthday_render() is SECURITY DEFINER and
      // keyed off auth.uid(), which is null here, so it cannot be used - the
      // message is assembled directly from the same sources it reads.
      const [{ data: tpl }, { data: settings }, { data: companyName }] = await Promise.all([
        admin.from("birthday_templates").select("subject, body").eq("id", r.template_id).maybeSingle(),
        admin.from("birthday_settings").select("show_powered_by, custom_footer, show_company_name, sender_name, sender_title").eq("tenant_id", r.tenant_id).maybeSingle(),
        admin.rpc("tenant_company_name", { p_tenant: r.tenant_id }),
      ]);

      if (!tpl) { skipped++; continue; }

      const company = typeof companyName === "string" ? companyName : "Your Company";
      const first = (r.full_name ?? "").trim().split(/\s+/)[0] || "there";

      const fill = (text: string) =>
        text
          .replace(/\{\{employee_first_name\}\}/g, first)
          .replace(/\{\{employee_full_name\}\}/g, r.full_name ?? "")
          .replace(/\{\{tenant_company_name\}\}/g, company)
          .replace(/\{\{sender_name\}\}/g, settings?.sender_name ?? "")
          .replace(/\{\{sender_title\}\}/g, settings?.sender_title ?? "")
          .replace(/\{\{current_year\}\}/g, String(new Date().getFullYear()))
          // Anything unsupported is stripped rather than left in the message.
          .replace(/\{\{[^}]*\}\}/g, "")
          .trim();

      const subject = fill(tpl.subject);
      let body = fill(tpl.body);

      if (settings?.show_powered_by !== false) {
        const footer = (settings?.custom_footer ?? "").trim() || "Powered by PivotOps";
        body = body + "\n\n" + footer;
      }

      const status = r.require_approval ? "pending_approval" : "approved";

      const { data: msg, error: insErr } = await admin.from("birthday_messages").insert({
        tenant_id: r.tenant_id,
        recipient_id: r.employee_id,
        template_id: r.template_id,
        channel: r.channel,
        subject,
        rendered_body: body,
        company_name_snapshot: company,
        footer_text: settings?.show_powered_by !== false ? ((settings?.custom_footer ?? "").trim() || "Powered by PivotOps") : null,
        status,
        birthday_year: r.birthday_year,
        created_by: null,
      }).select("id").single();

      if (insErr) {
        // 23505 = the unique index caught a duplicate. Expected, not an error.
        if (insErr.code === "23505") { skipped++; continue; }
        failed++; errors.push(`insert ${r.employee_id}: ${insErr.message}`);
        continue;
      }

      created++;
      await admin.from("birthday_delivery_events").insert({
        tenant_id: r.tenant_id, message_id: msg.id, event: "created", detail: "automation", actor_id: null,
      });

      // Approval required: stop here. A person releases it from the Messages tab.
      if (status === "pending_approval") { queued++; continue; }

      // Claim before sending so a retry or overlapping run cannot double-send.
      const { data: claimed } = await admin.from("birthday_messages")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", msg.id).eq("status", "approved").select("id");

      if (!claimed || claimed.length === 0) { skipped++; continue; }

      try {
        if (r.channel === "email") {
          if (!r.email) throw new Error("no_recipient_email");
          const html = '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">'
            + body.split("\n").filter(Boolean).map((l: string) => '<p style="margin:0 0 12px">' + l + "</p>").join("")
            + "</div>";
          const { ok } = await sendEmail({ to: r.email, subject: subject || "Happy Birthday!", html });
          if (!ok) throw new Error("email_send_failed");
        } else {
          const { error: nErr } = await admin.from("notifications").insert({
            tenant_id: r.tenant_id,
            user_id: String(r.employee_id),
            type: "birthday",
            title: subject || "Happy Birthday!",
            body,
            ref_id: msg.id,
            ref_type: "birthday_message",
            read: false,
          });
          if (nErr) throw new Error(nErr.message);
        }

        await admin.from("birthday_messages").update({
          status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", msg.id);
        await admin.from("birthday_delivery_events").insert({
          tenant_id: r.tenant_id, message_id: msg.id, event: "sent", detail: r.channel, actor_id: null,
        });
        sent++;
      } catch (e: any) {
        const reason = String(e?.message ?? "unknown").slice(0, 300);
        await admin.from("birthday_messages").update({
          status: "failed", failed_at: new Date().toISOString(),
          failure_reason: reason, retry_count: 1, updated_at: new Date().toISOString(),
        }).eq("id", msg.id);
        await admin.from("birthday_delivery_events").insert({
          tenant_id: r.tenant_id, message_id: msg.id, event: "failed", detail: reason, actor_id: null,
        });
        failed++; errors.push(`send ${r.employee_id}: ${reason}`);
      }
    }

    return NextResponse.json({ ok: true, due, created, sent, queued, skipped, failed, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/birthdays]", msg);
    return NextResponse.json({ ok: false, error: msg, due, created, sent, queued, skipped, failed, errors }, { status: 500 });
  }
}
