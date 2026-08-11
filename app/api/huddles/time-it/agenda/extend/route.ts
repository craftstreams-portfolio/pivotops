import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { extendAgendaItem } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const { roomId, itemId, extraSeconds } = await req.json();
  if (!roomId || !itemId || !extraSeconds) return NextResponse.json({ error: "roomId, itemId, extraSeconds required." }, { status: 400 });

  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    const item = await extendAgendaItem(roomId, auth.tenantId, itemId, extraSeconds);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to extend agenda item." }, { status: 500 });
  }
}