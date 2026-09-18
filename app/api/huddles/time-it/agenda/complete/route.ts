import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { completeAgendaItem } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const { roomId, itemId } = await req.json();
  if (!roomId || !itemId) return NextResponse.json({ error: "roomId and itemId required." }, { status: 400 });

  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    await completeAgendaItem(roomId, auth.tenantId, itemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to complete agenda item." }, { status: 500 });
  }
}