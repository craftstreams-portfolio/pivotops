import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getRoutingAction, mapToQueueCategory,
  type UserStatus, type EventPriority,
} from "@/lib/teams/status.engine";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Route a chat message through each recipient's status.
 *
 * Until now the status engine was never called at runtime: queue_items was
 * never written, so "In a Meeting" / "Do Not Disturb" changed the presence dot
 * and nothing else. This runs every message through getRoutingAction() for each
 * recipient and queues it when their status says to defer.
 *
 * Only writes rows for people whose status actually defers — ONLINE resolves to
 * "notify" (no row), so a busy channel doesn't write a row per member per message.
 */
export async function POST(req: NextRequest) {
  try {
    const { messageId, channelId, senderId, tenantId, content, senderName, priority: requestedPriority } = await req.json();
    if (!channelId || !senderId || !tenantId) {
      return NextResponse.json({ error: "Missing channel, sender or tenant." }, { status: 400 });
    }

    const admin = getAdmin();

    // ── Who receives this? ──
    const { data: channel } = await admin
      .from("channels").select("id, name, type, member_one, member_two")
      .eq("id", channelId).maybeSingle();

    const isDM = !!(channel?.member_one && channel?.member_two);

    let recipientIds: string[] = [];
    if (isDM) {
      recipientIds = [channel!.member_one, channel!.member_two].filter((id: string) => id && id !== senderId);
    } else {
      const { data: members } = await admin
        .from("profiles").select("id").eq("tenant_id", tenantId);
      recipientIds = (members ?? []).map((m: any) => m.id).filter((id: string) => id !== senderId);
    }
    if (recipientIds.length === 0) return NextResponse.json({ ok: true, routed: 0 });

    // ── Presence for those recipients ──
    const { data: presence } = await admin
      .from("presence_states").select("user_id, status").in("user_id", recipientIds);
    const statusOf = new Map<string, UserStatus>();
    for (const p of presence ?? []) statusOf.set(p.user_id, p.status as UserStatus);

    // Only admins/managers may raise a message's priority. The composer hides the
    // control, but authority lives here — a crafted request must not be able to
    // mark a message critical and break through everyone's DND.
    let effectivePriority: EventPriority | null = null;
    if (requestedPriority && ["critical", "high", "normal", "low"].includes(requestedPriority)) {
      const { data: sender } = await admin
        .from("profiles").select("role").eq("id", senderId).maybeSingle();
      if (sender?.role === "admin" || sender?.role === "manager") {
        effectivePriority = requestedPriority as EventPriority;
      }
    }

    const text = String(content ?? "");
    const mentionsAll = /@all\b/i.test(text);

    const rows: any[] = [];
    let notified = 0;

    for (const rid of recipientIds) {
      // No presence row means they've never set one — treat as OFFLINE (queue).
      const status = statusOf.get(rid) ?? "OFFLINE";

      // Priority: @all is critical, a direct mention or DM is high, else normal.
      const mentionedDirectly = new RegExp(`@${rid}\\b`).test(text);
      // An explicit, authorised priority wins; otherwise infer from the content.
      const priority: EventPriority =
        effectivePriority ??
        (mentionsAll ? "critical"
         : (isDM || mentionedDirectly) ? "high"
         : "normal");

      const action = getRoutingAction(status, priority);

      // notify = real-time only, block = discard. Neither leaves a queue row.
      if (action === "notify" || action === "block") { if (action === "notify") notified++; continue; }

      const sourceType = mentionsAll || mentionedDirectly ? "mention" : "message";
      rows.push({
        tenant_id:   tenantId,
        user_id:     rid,
        source_type: sourceType,
        source_id:   messageId ?? null,
        category:    mapToQueueCategory(sourceType, priority),
        priority,
        status:      "pending",
        title:       isDM
          ? `Message from ${senderName ?? "a teammate"}`
          : `${senderName ?? "A teammate"} in #${channel?.name ?? "channel"}`,
        summary:     text.slice(0, 180) || null,
        created_at:  new Date().toISOString(),
      });
    }

    if (rows.length > 0) {
      const { error } = await admin.from("queue_items").insert(rows);
      if (error) {
        console.error("[route-event] queue insert failed:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, queued: rows.length, notified });
  } catch (e: any) {
    console.error("[route-event]", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}