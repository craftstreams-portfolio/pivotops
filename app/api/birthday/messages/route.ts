import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";

const ACTIONS = ["create", "approve", "reject", "send", "cancel"] as const;
type Action = (typeof ACTIONS)[number];

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getAuthedUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function logEvent(admin: any, tenantId: string, messageId: string, event: string, detail: string | null, actorId: string | null) {
  await admin.from("birthday_delivery_events").insert({
    tenant_id: tenantId, message_id: messageId, event, detail, actor_id: actorId,
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await req.json();
    const action = body?.action as Action;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const admin = getAdmin();

    // Tenant and role come from the caller's own profile. A tenant_id in the
    // request body is never read.
    const { data: actor } = await admin
      .from("profiles").select("id, tenant_id, role, status, full_name")
      .eq("id", user.id).maybeSingle();

    if (!actor?.tenant_id) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
    if (actor.status !== "active") {
      return NextResponse.json({ error: "Your access has been revoked." }, { status: 403 });
    }

    const tenantId = actor.tenant_id;
    const isApprover = ["admin", "manager"].includes(actor.role ?? "");

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const { recipientId, templateId, channel } = body;
      if (!recipientId || !templateId || !["in_app", "email"].includes(channel)) {
        return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
      }

      const { data: settings } = await admin
        .from("birthday_settings").select("*").eq("tenant_id", tenantId).maybeSingle();

      if (settings && settings.enabled === false) {
        return NextResponse.json({ error: "Birthday Hub is disabled for this workspace." }, { status: 403 });
      }

      // Rendering is done by birthday_render() under the CALLER's identity, so
      // cross-tenant recipients and opted-out employees are rejected there
      // rather than trusted here. The service-role client would bypass that,
      // so this one call deliberately uses the user's own session.
      const userClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
      );
      const { data: rendered, error: rErr } = await userClient.rpc("birthday_render", {
        p_template: templateId, p_recipient: recipientId,
      });

      if (rErr) {
        console.error("[birthday/messages] render:", rErr.message);
        return NextResponse.json({ error: "Could not prepare the message." }, { status: 500 });
      }
      if (!rendered?.ok) {
        const map: Record<string, string> = {
          forbidden: "You do not have permission to do that.",
          not_found: "That employee is not in your workspace.",
          template_not_found: "That template is not available.",
          recipient_opted_out: "This employee has hidden their birthday or opted out of messages.",
        };
        return NextResponse.json(
          { error: map[rendered?.reason] ?? "Could not prepare the message.", reason: rendered?.reason },
          { status: rendered?.reason === "recipient_opted_out" ? 409 : 400 }
        );
      }

      const requiresApproval = rendered.requires_approval !== false;
      const status = requiresApproval ? "pending_approval" : "approved";

      const fullBody = rendered.footer
        ? rendered.body + "\n\n" + rendered.footer
        : rendered.body;

      const { data: msg, error: insErr } = await admin.from("birthday_messages").insert({
        tenant_id: tenantId,
        recipient_id: recipientId,
        template_id: templateId,
        channel,
        subject: rendered.subject,
        rendered_body: fullBody,
        company_name_snapshot: rendered.company_name,
        footer_text: rendered.footer ?? null,
        status,
        birthday_year: new Date().getFullYear(),
        created_by: actor.id,
      }).select("id").single();

      if (insErr) {
        // The partial unique index is the idempotency guarantee: a second
        // attempt for the same person, channel and year lands here rather than
        // sending a duplicate.
        if (insErr.code === "23505") {
          return NextResponse.json(
            { error: "A birthday message for this employee already exists this year.", reason: "duplicate" },
            { status: 409 }
          );
        }
        console.error("[birthday/messages] insert:", insErr.message);
        return NextResponse.json({ error: "Could not save the message." }, { status: 500 });
      }

      await logEvent(admin, tenantId, msg.id, "created", "status=" + status, actor.id);
      return NextResponse.json({ ok: true, id: msg.id, status, preview: { subject: rendered.subject, body: fullBody } });
    }

    // ── Everything below operates on an existing message ────────────────────
    const { messageId } = body;
    if (!messageId) return NextResponse.json({ error: "Missing message." }, { status: 400 });

    const { data: msg } = await admin
      .from("birthday_messages").select("*").eq("id", messageId).maybeSingle();

    if (!msg || msg.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    // ── APPROVE / REJECT ────────────────────────────────────────────────────
    if (action === "approve" || action === "reject") {
      if (!isApprover) {
        return NextResponse.json({ error: "You do not have permission to approve messages." }, { status: 403 });
      }
      if (msg.status !== "pending_approval") {
        return NextResponse.json({ error: "This message is not awaiting approval." }, { status: 400 });
      }
      // Separation of duties: the author cannot approve their own message.
      if (action === "approve" && msg.created_by === actor.id) {
        return NextResponse.json({ error: "Someone else needs to approve a message you wrote." }, { status: 403 });
      }

      const patch = action === "approve"
        ? { status: "approved", approved_by: actor.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { status: "rejected", rejection_reason: String(body.reason ?? "").slice(0, 300) || null, updated_at: new Date().toISOString() };

      await admin.from("birthday_messages").update(patch).eq("id", messageId);
      await logEvent(admin, tenantId, messageId, action === "approve" ? "approved" : "rejected", body.reason ?? null, actor.id);
      return NextResponse.json({ ok: true, status: patch.status });
    }

    // ── CANCEL ──────────────────────────────────────────────────────────────
    if (action === "cancel") {
      if (!isApprover && msg.created_by !== actor.id) {
        return NextResponse.json({ error: "You cannot cancel this message." }, { status: 403 });
      }
      if (["sent", "sending"].includes(msg.status)) {
        return NextResponse.json({ error: "This message has already gone out." }, { status: 400 });
      }
      await admin.from("birthday_messages")
        .update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", messageId);
      await logEvent(admin, tenantId, messageId, "cancelled", null, actor.id);
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    // ── SEND ────────────────────────────────────────────────────────────────
    if (!isApprover) {
      return NextResponse.json({ error: "You do not have permission to send messages." }, { status: 403 });
    }
    if (msg.status !== "approved") {
      return NextResponse.json({ error: "Only an approved message can be sent." }, { status: 400 });
    }

    // Claim the row before doing any work. The status filter makes this atomic:
    // a second concurrent request updates zero rows and stops here, so two
    // admins clicking send cannot both dispatch.
    const { data: claimed } = await admin
      .from("birthday_messages")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", messageId).eq("status", "approved")
      .select("id");

    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: "This message is already being sent." }, { status: 409 });
    }

    await logEvent(admin, tenantId, messageId, "sending", null, actor.id);

    // Re-check consent at send time: the employee may have opted out between
    // drafting and sending.
    const { data: bp } = await admin
      .from("birthday_profiles").select("visibility, allow_automatic_messages")
      .eq("employee_id", msg.recipient_id).maybeSingle();

    if (bp && (bp.visibility === "hidden" || bp.allow_automatic_messages === false)) {
      await admin.from("birthday_messages").update({
        status: "suppressed", suppression_reason: "recipient_opted_out", updated_at: new Date().toISOString(),
      }).eq("id", messageId);
      await logEvent(admin, tenantId, messageId, "suppressed", "recipient_opted_out", actor.id);
      return NextResponse.json({ ok: false, status: "suppressed", reason: "recipient_opted_out" });
    }

    const { data: rcpt } = await admin
      .from("profiles").select("email, full_name").eq("id", msg.recipient_id).maybeSingle();

    try {
      if (msg.channel === "email") {
        if (!rcpt?.email) throw new Error("no_recipient_email");
        const html = '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">'
          + msg.rendered_body.split("\n").filter(Boolean)
              .map((line: string) => '<p style="margin:0 0 12px">' + line + "</p>").join("")
          + "</div>";
        const { ok } = await sendEmail({ to: rcpt.email, subject: msg.subject ?? "Happy Birthday!", html });
        if (!ok) throw new Error("email_send_failed");
      } else {
        const { error: nErr } = await admin.from("notifications").insert({
          tenant_id: tenantId,
          user_id: String(msg.recipient_id),
          type: "birthday",
          title: msg.subject ?? "Happy Birthday!",
          body: msg.rendered_body,
          ref_id: messageId,
          ref_type: "birthday_message",
          read: false,
        });
        if (nErr) throw new Error(nErr.message);
      }

      await admin.from("birthday_messages").update({
        status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", messageId);
      await logEvent(admin, tenantId, messageId, "sent", msg.channel, actor.id);

      return NextResponse.json({ ok: true, status: "sent" });
    } catch (e: any) {
      const reason = e?.message ?? "unknown";
      await admin.from("birthday_messages").update({
        status: "failed", failed_at: new Date().toISOString(),
        failure_reason: String(reason).slice(0, 300),
        retry_count: (msg.retry_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", messageId);
      await logEvent(admin, tenantId, messageId, "failed", String(reason).slice(0, 300), actor.id);
      console.error("[birthday/messages] send:", reason);
      return NextResponse.json({ error: "The message could not be delivered.", status: "failed" }, { status: 500 });
    }
  } catch (e: any) {
    console.error("[birthday/messages]", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
