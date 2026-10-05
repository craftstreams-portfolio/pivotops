import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireHost } from "@/lib/huddles/requireHost";
import { extendTimer, getTimerState } from "@/lib/huddles/time-it";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const { roomId, extraSeconds } = await req.json();
  if (!roomId || !extraSeconds) return NextResponse.json({ error: "roomId and extraSeconds required." }, { status: 400 });

  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    const before = await getTimerState(roomId);
    const state = await extendTimer(roomId, auth.tenantId, extraSeconds);

    // Spec section 11: an extension granted after auto-mute must restore
    // speaking permission - only because the host explicitly granted it here.
    if (before?.status === "expired" && before.current_speaker_id) {
      const admin = getAdmin();
      await admin.from("voice_room_participants")
        .update({ is_muted: false, mute_reason: null })
        .eq("room_id", roomId).eq("user_id", before.current_speaker_id).eq("mute_reason", "time_it_expired");
    }

    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to extend timer." }, { status: 500 });
  }
}