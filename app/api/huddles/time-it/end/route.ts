import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { endTimer } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const { roomId, roomType } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required." }, { status: 400 });
  const type: "huddle" | "meeting" = roomType === "meeting" ? "meeting" : "huddle";

  const auth = await requireHost(req, roomId, type);
  if ("error" in auth) return auth.error;

  try {
    await endTimer(roomId, auth.tenantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to end timer." }, { status: 500 });
  }
}
