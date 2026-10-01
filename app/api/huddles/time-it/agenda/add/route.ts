import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { addAgendaItem } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const { roomId, title, description, ownerId, durationSeconds } = await req.json();
  if (!roomId || !title || !durationSeconds) return NextResponse.json({ error: "roomId, title, durationSeconds required." }, { status: 400 });

  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    const item = await addAgendaItem({ roomId, tenantId: auth.tenantId, hostId: auth.userId, title, description, ownerId, durationSeconds });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add agenda item." }, { status: 500 });
  }
}