import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/supabase-admin";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { processMentions, resolveMention, getMentionAnalytics, xavierAutoEscalate } from "@/lib/mentions/mention.engine";

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

const PostSchema = z.object({
  action: z.enum(["process", "resolve", "escalate", "analytics"]),
  content: z.string().optional(),
  context: z.string().optional(),
  taskId: z.string().optional(),
  createdBy: z.string().optional(),
  mentionId: z.string().optional(),
  resolvedBy: z.string().optional(),
});

export const POST = withSecurity(
  async (_req, { auth, body }) => {
    const tenantId = auth!.tenantId;
    const { action } = body;

    if (action === "process") {
      const { content, context, taskId, createdBy } = body;
      if (!content || !context || !createdBy) {
        return NextResponse.json({ message: "content, context and createdBy are required" }, { status: 400 });
      }
      const { data: profiles } = await getAdmin().from("profiles").select("id, full_name, email").eq("tenant_id", tenantId);
      const mentions = await processMentions({ content, context: context as any, taskId, createdBy, tenantId, profiles: profiles ?? [] });
      return NextResponse.json({ success: true, mentions: mentions.length, parsed: mentions.map((m) => ({ id: m.id, mentionType: m.mention_type, refName: m.ref_name, escalated: m.escalated })) });
    }

    if (action === "resolve") {
      const { mentionId, resolvedBy } = body;
      if (!mentionId || !resolvedBy) return NextResponse.json({ message: "mentionId and resolvedBy are required" }, { status: 400 });
      await resolveMention(mentionId, resolvedBy);
      return NextResponse.json({ success: true, mentionId, resolved: true });
    }

    if (action === "escalate") {
      await xavierAutoEscalate(tenantId);
      return NextResponse.json({ success: true, message: "Xavier AI auto-escalation scan complete" });
    }

    if (action === "analytics") {
      const analytics = await getMentionAnalytics(tenantId);
      return NextResponse.json({ success: true, analytics });
    }

    return NextResponse.json({ message: "Unknown action" }, { status: 400 });
  },
  { schema: PostSchema, requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);

export const GET = withSecurity(
  async (req, { auth }) => {
    const tenantId = auth!.tenantId;
    const taskId = req.nextUrl.searchParams.get("taskId");
    const resolved = req.nextUrl.searchParams.get("resolved");
    let query = getAdmin().from("mentions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    if (taskId) query = query.eq("task_id", taskId);
    if (resolved === "0") query = query.eq("resolved", false);
    if (resolved === "1") query = query.eq("resolved", true);
    const { data, error } = await query.limit(100);
    if (error) return NextResponse.json({ message: extractMessage(error) }, { status: 500 });
    return NextResponse.json({ success: true, mentions: data ?? [], count: data?.length ?? 0 });
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);

const PatchSchema = z.object({ mentionId: z.string(), resolvedBy: z.string() });

export const PATCH = withSecurity(
  async (_req, { body }) => {
    await resolveMention(body.mentionId, body.resolvedBy);
    return NextResponse.json({ success: true, mentionId: body.mentionId, resolved: true });
  },
  { schema: PatchSchema, requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);