import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";

// Public, unauthenticated endpoint. Every operation is validated server-side
// against the guest token. The client never supplies a tenant_id, channel_id
// or sender identity - all three are resolved here from support_config and the
// token, so a forged request has nothing to redirect.

export const maxDuration = 30;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const MAX_MESSAGE = 2000;
const rate = new Map<string, { n: number; reset: number }>();

function rateOk(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const e = rate.get(key);
  if (!e || now > e.reset) { rate.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (e.n >= limit) return false;
  e.n++; return true;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;
    const admin = getAdmin();
    const ip = clientIp(req);

    const { data: cfg } = await admin
      .from("support_config").select("*").eq("key", "default").maybeSingle();

    if (!cfg?.enabled) {
      return NextResponse.json({ error: "Support chat is unavailable." }, { status: 503 });
    }

    // ── START: create the guest session and its conversation channel ────────
    if (action === "start") {
      if (!rateOk("start:" + ip, 5, 60 * 60 * 1000)) {
        return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
      }

      const name = String(body.name ?? "").trim().slice(0, 80);
      const email = String(body.email ?? "").trim().toLowerCase().slice(0, 120);
      const company = String(body.company ?? "").trim().slice(0, 80) || null;
      const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);

      if (!name || !email || !message || !email.includes("@")) {
        return NextResponse.json({ error: "Name, work email and a message are required." }, { status: 400 });
      }

      const token = randomBytes(32).toString("base64url");

      // One channel per inquiry: the channels table has no thread model, so a
      // separate row per conversation is what keeps inquiries distinguishable
      // in Teams and scopes the visitor's realtime topic to their own messages.
      const { data: ch, error: chErr } = await admin.from("channels").insert({
        // Channel names are unique per tenant, so a repeat visitor would collide
        // with their own earlier inquiry. The token suffix keeps each one distinct
        // while staying readable in the channel list.
        name: "Website Inquiry - " + name + " " + token.slice(0, 6),
        tenant_id: cfg.tenant_id,
        type: "channel",
        created_by: null,
      }).select("id").single();

      if (chErr) {
        console.error("[support/chat] channel:", chErr.message);
        return NextResponse.json({ error: "Could not start the chat." }, { status: 500 });
      }

      const { error: gErr } = await admin.from("support_guests").insert({
        token, tenant_id: cfg.tenant_id, name, email, company,
        channel_id: ch.id, source: "website",
        landing_page: String(body.landingPage ?? "").slice(0, 300) || null,
        referrer: String(body.referrer ?? "").slice(0, 300) || null,
        ip_address: ip, user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        status: "NEW",
      });

      if (gErr) {
        // Messages first: messages.channel_id has a foreign key, so deleting the
        // channel while a row references it throws and masks the real error.
        await admin.from("messages").delete().eq("channel_id", ch.id);
        await admin.from("channels").delete().eq("id", ch.id);
        console.error("[support/chat] guest:", gErr.message);
        return NextResponse.json({ error: "Could not start the chat." }, { status: 500 });
      }

      // Header card in the inquiry channel so an agent sees who this is.
      await admin.from("messages").insert({
        channel_id: ch.id, tenant_id: cfg.tenant_id,
        user_id: "system", user_name: "PivotOps",
        type: "system",
        content: "NEW CUSTOMER INQUIRY\n" + name + (company ? "\n" + company : "") + "\n" + email + "\nSource: PivotOps website",
        meta: { sender_type: "system", visibility: "public" },
      });

      await admin.from("messages").insert({
        channel_id: ch.id, tenant_id: cfg.tenant_id,
        user_id: "guest:" + token, user_name: name,
        type: "text", content: message,
        meta: { sender_type: "guest", visibility: "public", email, company },
      });

      // Announce in Sales so the team notices without the inquiry living there.
      await admin.from("messages").insert({
        channel_id: cfg.sales_channel_id, tenant_id: cfg.tenant_id,
        user_id: "system", user_name: "PivotOps",
        type: "system",
        content: "New customer inquiry from " + name + (company ? " (" + company + ")" : "") + " - see #website-inquiry",
        meta: { sender_type: "system", visibility: "public", inquiry_channel_id: ch.id },
      });

      // Alert the team. Sent after the conversation is safely persisted and
      // wrapped so a mail failure never costs the visitor their chat.
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";
        const link = appUrl + "/dashboard/teams?channel=" + ch.id;
        const esc = (s: string) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        await sendEmail({
          to: "inquiries@pivotops.app",
          subject: "New inquiry: " + name + (company ? " (" + company + ")" : ""),
          html: [
            String.raw`<div style="background:#f4f4f5;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">`,
            String.raw`<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">`,
            String.raw`<div style="padding:24px 28px 8px;"><div style="font-size:11px;letter-spacing:1.5px;color:#a1a1aa;text-transform:uppercase;">New customer inquiry</div>`,
            String.raw`<h2 style="margin:8px 0 0;font-size:18px;color:#18181b;">` + esc(name) + String.raw`</h2>`,
            company ? String.raw`<p style="margin:2px 0 0;font-size:13px;color:#71717a;">` + esc(company) + String.raw`</p>` : "",
            String.raw`<p style="margin:2px 0 0;font-size:13px;color:#71717a;">` + esc(email) + String.raw`</p></div>`,
            String.raw`<div style="padding:16px 28px;"><div style="background:#fafafa;border-left:3px solid #10b981;padding:12px 14px;border-radius:6px;font-size:14px;color:#3f3f46;white-space:pre-wrap;">` + esc(message) + String.raw`</div></div>`,
            String.raw`<div style="padding:4px 28px 28px;text-align:center;"><a href="` + link + String.raw`" style="background:#10b981;color:#fff;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;display:inline-block;">Reply in Teams</a></div>`,
            String.raw`</div></div>`,
          ].join(""),
        });
      } catch (mailErr) {
        console.error("[support/chat] alert email:", mailErr);
      }

      return NextResponse.json({
        ok: true, token,
        identity: cfg.public_identity,
        welcome: cfg.welcome_message,
      });
    }

    // ── Everything else needs a valid token ─────────────────────────────────
    const token = String(body.token ?? "");
    if (!token) return NextResponse.json({ error: "Session required." }, { status: 401 });

    const { data: guest } = await admin
      .from("support_guests").select("*").eq("token", token).maybeSingle();

    if (!guest || new Date(guest.expires_at) < new Date()) {
      return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
    }

    // ── SEND ────────────────────────────────────────────────────────────────
    if (action === "send") {
      if (!rateOk("send:" + token, 30, 60 * 1000)) {
        return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
      }
      if (guest.status === "CLOSED") {
        return NextResponse.json({ error: "This conversation has been closed." }, { status: 409 });
      }

      const content = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);
      if (!content) return NextResponse.json({ error: "Empty message." }, { status: 400 });

      const { data: msg, error } = await admin.from("messages").insert({
        channel_id: guest.channel_id, tenant_id: guest.tenant_id,
        user_id: "guest:" + token, user_name: guest.name,
        type: "text", content,
        meta: { sender_type: "guest", visibility: "public" },
      }).select("id, created_at").single();

      if (error) {
        console.error("[support/chat] send:", error.message);
        return NextResponse.json({ error: "Your message could not be sent." }, { status: 500 });
      }

      await admin.from("support_guests")
        .update({ status: "WAITING_FOR_SUPPORT", last_seen_at: new Date().toISOString() })
        .eq("token", token);

      return NextResponse.json({ ok: true, id: msg.id, created_at: msg.created_at });
    }

    // ── HISTORY: restores the conversation on reconnect ──────────────────────
    if (action === "history") {
      const { data: msgs } = await admin
        .from("messages")
        .select("id, content, user_name, meta, created_at, type")
        .eq("channel_id", guest.channel_id)
        .order("created_at", { ascending: true })
        .limit(200);

      // Internal notes are stripped here. They never leave the server.
      const visible = (msgs ?? []).filter(
        (m: any) => (m.meta?.visibility ?? "public") !== "internal"
      ).map((m: any) => ({
        id: m.id,
        content: m.content,
        author: m.meta?.sender_type === "guest" ? m.user_name : cfg.public_identity,
        sender_type: m.meta?.sender_type ?? "agent",
        created_at: m.created_at,
      }));

      await admin.from("support_guests")
        .update({ last_seen_at: new Date().toISOString() }).eq("token", token);

      return NextResponse.json({
        ok: true, messages: visible,
        identity: cfg.public_identity,
        status: guest.status,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("[support/chat]", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
