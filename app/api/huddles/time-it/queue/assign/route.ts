import { NextRequest, NextResponse } from "next/server";
import { requireHost } from "@/lib/huddles/requireHost";
import { assignSpeakers } from "@/lib/huddles/time-it";

export async function POST(req: NextRequest) {
  const { roomId, assignments } = await req.json();
  if (!roomId || !Array.isArray(assignments) || assignments.length === 0) {
    return NextResponse.json({ error: "roomId and assignments[] required." }, { status: 400 });
  }
  const auth = await requireHost(req, roomId);
  if ("error" in auth) return auth.error;

  try {
    const items = await assignSpeakers({ roomId, tenantId: auth.tenantId, hostId: auth.userId, assignments });
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to assign speakers." }, { status: 500 });
  }
}