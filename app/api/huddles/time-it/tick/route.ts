import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAndAdvance } from "@/lib/huddles/time-it";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/**
 * Polled every 1-2s by any client viewing an active Time It session.
 * roomType selects whether roomId refers to a voice_rooms (huddle) or
 * meetings (conference) row - everything downstream (state table, agenda,
 * queue) is already keyed by a generic room_id and needs no branching.
 */
export async function POST(req: NextRequest) {
  const { roomId, roomType } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required." }, { status: 400 });
  const type: "huddle" | "meeting" = roomType === "meeting" ? "meeting" : "huddle";
  const admin = getAdmin();

  const { data: room } = type === "meeting"
    ? await admin.from("meetings").select("tenant_id").eq("id", roomId).maybeSingle()
    : await admin.from("voice_rooms").select("tenant_id").eq("id", roomId).maybeSingle();

  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const state = await checkAndAdvance(roomId, room.tenant_id, type);
  return NextResponse.json({ state });
}
