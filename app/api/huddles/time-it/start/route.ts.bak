import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { startTimer } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { roomId, speakerId, speakerName, durationSeconds, autoMute } = body;
  if (!roomId || !speakerId || !durationSeconds) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    const state = await startTimer({
      roomId, tenantId: auth.tenantId, hostId: auth.userId,
      speakerId, speakerName: speakerName ?? "", durationSeconds,
      autoMute: autoMute !== false,
    });
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start timer." }, { status: 500 });
  }
}