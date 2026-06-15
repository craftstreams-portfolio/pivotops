import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/chat/unread?userId=XXX
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({}, { status: 400 });

    const db = getAdmin();

    // Get all channels
    const { data: channels } = await db
      .from("channels")
      .select("id");

    if (!channels?.length) return NextResponse.json({});

    const channelIds = channels.map((c: any) => c.id);

    // Get last read timestamps for this user
    const { data: reads } = await db
      .from("channel_reads")
      .select("channel_id, last_read_at")
      .eq("user_id", userId);

    const readMap: Record<string, string> = {};
    (reads ?? []).forEach((r: any) => { readMap[r.channel_id] = r.last_read_at; });

    // Count unread messages per channel
    const counts: Record<string, number> = {};

    await Promise.all(channelIds.map(async (channelId: string) => {
      const lastRead = readMap[channelId];
      let query = db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .eq("retracted", false)
        .neq("user_id", userId); // don't count own messages

      if (lastRead) {
        query = query.gt("created_at", lastRead);
      }

      const { count } = await query;
      if (count && count > 0) counts[channelId] = count;
    }));

    return NextResponse.json(counts);
  } catch (e) {
    console.error("[unread GET]", e);
    return NextResponse.json({}, { status: 500 });
  }
}

// POST /api/chat/unread — mark channel as read
export async function POST(req: NextRequest) {
  try {
    const { userId, channelId } = await req.json();
    if (!userId || !channelId) {
      return NextResponse.json({ error: "userId and channelId required" }, { status: 400 });
    }

    const db = getAdmin();
    const now = new Date().toISOString();

    const { data: existing } = await db
      .from("channel_reads")
      .select("id")
      .eq("user_id", userId)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (existing) {
      await db
        .from("channel_reads")
        .update({ last_read_at: now, updated_at: now })
        .eq("user_id", userId)
        .eq("channel_id", channelId);
    } else {
      await db
        .from("channel_reads")
        .insert({ user_id: userId, channel_id: channelId, last_read_at: now, created_at: now, updated_at: now });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[unread POST]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}