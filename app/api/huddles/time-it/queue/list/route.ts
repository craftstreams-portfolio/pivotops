import { NextRequest, NextResponse } from "next/server";
import { getSpeakerQueue } from "@/lib/huddles/time-it";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "roomId required." }, { status: 400 });
  const items = await getSpeakerQueue(roomId);
  return NextResponse.json({ items });
}