import { NextRequest, NextResponse } from "next/server";
import { getUnreadCount } from "@/lib/messages/unread";

export async function POST(req: NextRequest) {
  const { userId, channelId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: "userId required" },
      { status: 400 }
    );
  }

  const count = await getUnreadCount(userId, channelId);

  return NextResponse.json({
    success: true,
    unread: count,
  });
}