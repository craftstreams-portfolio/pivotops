import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export const GET = withSecurity(
  async (req, { auth }) => {
    const userId = auth!.userId;
    const tenantId = auth!.tenantId;
    const db = getAdmin();
    const { data: channels } = await db.from("channels").select("id").eq("tenant_id", tenantId);
    if (!channels?.length) return NextResponse.json({});
    const channelIds = channels.map((c: any) => c.id);
    const { data: reads } = await db.from("channel_reads").select("channel_id, last_read_at").eq("user_id", userId);
    const readMap: Record<string, string> = {};
    (reads ?? []).forEach((r: any) => { readMap[r.channel_id] = r.last_read_at; });
    const counts: Record<string, number> = {};
    await Promise.all(channelIds.map(async (channelId: string) => {
      const lastRead = readMap[channelId];
      let query = db.from("messages").select("id", { count: "exact", head: true })
        .eq("channel_id", channelId).eq("retracted", false).neq("user_id", userId);
      if (lastRead) query = query.gt("created_at", lastRead);
      const { count } = await query;
      if (count && count > 0) counts[channelId] = count;
    }));
    return NextResponse.json(counts);
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);

export const POST = withSecurity(
  async (req, { auth }) => {
    const { channelId } = await req.json();
    if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
    const userId = auth!.userId;
    const db = getAdmin();
    const now = new Date().toISOString();
    const { data: existing } = await db.from("channel_reads").select("id").eq("user_id", userId).eq("channel_id", channelId).maybeSingle();
    if (existing) {
      await db.from("channel_reads").update({ last_read_at: now, updated_at: now }).eq("user_id", userId).eq("channel_id", channelId);
    } else {
      await db.from("channel_reads").insert({ user_id: userId, channel_id: channelId, last_read_at: now, created_at: now, updated_at: now });
    }
    return NextResponse.json({ success: true });
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);