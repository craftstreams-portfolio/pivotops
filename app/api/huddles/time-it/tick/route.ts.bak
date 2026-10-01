import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAndAdvance } from "@/lib/huddles/time-it";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/**
 * Polled every 1-2s by any client viewing an active Time It session. No
 * background worker checks expiration (see lib/huddles/time-it.ts header
 * comment) - this route is what actually advances warnings and expiry,
 * called from whichever client happens to be open. Idempotent: firing
 * warning/expiry logic twice does nothing extra, guarded by the
 * warning_60_fired/warning_30_fired/status flags in the DB row.
 */
export async function POST(req: NextRequest) {
  const { roomId } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required." }, { status: 400 });

  const admin = getAdmin();
  const { data: room } = await admin.from("voice_rooms").select("tenant_id").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const state = await checkAndAdvance(roomId, room.tenant_id);
  return NextResponse.json({ state });
}