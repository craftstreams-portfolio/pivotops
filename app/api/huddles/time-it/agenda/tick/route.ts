import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAgendaAdvance } from "@/lib/huddles/time-it";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const { roomId } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required." }, { status: 400 });

  const admin = getAdmin();
  const { data: room } = await admin.from("voice_rooms").select("tenant_id").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const item = await checkAgendaAdvance(roomId, room.tenant_id);
  return NextResponse.json({ item });
}