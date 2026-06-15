import { NextResponse, NextRequest } from "next/server";
import { supabase }                  from "@/lib/supabase";
import {
  processMentions,
  resolveMention,
  getMentionAnalytics,
  xavierAutoEscalate,
} from "@/lib/mentions/mention.engine";

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// POST /api/mentions
// Body variants:
//   action: "process"  — parse + emit mentions from content
//   action: "resolve"  — mark a mention resolved
//   action: "escalate" — trigger Xavier auto-escalation scan
//   action: "analytics"— return mention analytics
// ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tenantId = "default" } = body;

    if (!action) {
      return NextResponse.json(
        { message: "action is required" },
        { status: 400 }
      );
    }

    // ── 1. PROCESS MENTIONS ───────────────
    if (action === "process") {
      const { content, context, taskId, createdBy } = body;

      if (!content || !context || !createdBy) {
        return NextResponse.json(
          { message: "content, context and createdBy are required" },
          { status: 400 }
        );
      }

      // Load profiles for mention resolution
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId);

      const mentions = await processMentions({
        content,
        context,
        taskId:    taskId  ?? undefined,
        createdBy,
        tenantId,
        profiles:  profiles ?? [],
      });

      return NextResponse.json({
        success:  true,
        mentions: mentions.length,
        parsed:   mentions.map((m) => ({
          id:          m.id,
          mentionType: m.mention_type,
          refName:     m.ref_name,
          escalated:   m.escalated,
        })),
      });
    }

    // ── 2. RESOLVE MENTION ────────────────
    if (action === "resolve") {
      const { mentionId, resolvedBy } = body;

      if (!mentionId || !resolvedBy) {
        return NextResponse.json(
          { message: "mentionId and resolvedBy are required" },
          { status: 400 }
        );
      }

      await resolveMention(mentionId, resolvedBy);

      return NextResponse.json({
        success:   true,
        mentionId,
        resolved:  true,
      });
    }

    // ── 3. XAVIER AUTO-ESCALATION ─────────
    // Called by cron every hour to check stale/overdue tasks
    if (action === "escalate") {
      await xavierAutoEscalate(tenantId);

      return NextResponse.json({
        success: true,
        message: "Xavier AI auto-escalation scan complete",
      });
    }

    // ── 4. ANALYTICS ──────────────────────
    if (action === "analytics") {
      const analytics = await getMentionAnalytics(tenantId);

      return NextResponse.json({
        success: true,
        analytics,
      });
    }

    return NextResponse.json(
      { message: `Unknown action: ${action}` },
      { status: 400 }
    );

  } catch (err) {
    const msg = extractMessage(err);
    console.error("Mentions route failed:", msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────
// GET /api/mentions?tenantId=X&taskId=Y
// Returns mentions for a task or tenant
// ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") ?? "default";
    const taskId   = searchParams.get("taskId");
    const resolved = searchParams.get("resolved");

    let query = supabase
      .from("mentions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (taskId)           query = query.eq("task_id", taskId);
    if (resolved === "0") query = query.eq("resolved", false);
    if (resolved === "1") query = query.eq("resolved", true);

    const { data, error } = await query.limit(100);

    if (error) {
      throw new Error(extractMessage(error));
    }

    return NextResponse.json({
      success:  true,
      mentions: data ?? [],
      count:    data?.length ?? 0,
    });

  } catch (err) {
    const msg = extractMessage(err);
    console.error("Mentions GET failed:", msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────
// PATCH /api/mentions
// Body: { mentionId, resolvedBy }
// Quick resolve endpoint for UI buttons
// ─────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { mentionId, resolvedBy } = await req.json();

    if (!mentionId || !resolvedBy) {
      return NextResponse.json(
        { message: "mentionId and resolvedBy are required" },
        { status: 400 }
      );
    }

    await resolveMention(mentionId, resolvedBy);

    return NextResponse.json({
      success:  true,
      mentionId,
      resolved: true,
    });

  } catch (err) {
    const msg = extractMessage(err);
    console.error("Mentions PATCH failed:", msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}