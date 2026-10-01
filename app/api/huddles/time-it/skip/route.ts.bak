import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { skipSpeaker } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const { roomId } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required." }, { status: 400 });

  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    const state = await skipSpeaker(roomId, auth.tenantId);
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to skip speaker." }, { status: 500 });
  }
}