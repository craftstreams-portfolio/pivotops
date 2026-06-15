import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      channelId,
      userId,
    }: {
      channelId?: string;
      userId?: string;
    } = body;

    if (!channelId || !userId) {
      return NextResponse.json(
        {
          error: "channelId and userId are required",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("channel_members")
      .upsert(
        {
          channel_id: channelId,
          user_id: userId,
          last_read_at: now,
        },
        {
          onConflict: "channel_id,user_id",
        }
      );

    if (error) {
      console.error("[chat/read]", error);

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      channelId,
      userId,
      lastReadAt: now,
    });
  } catch (error) {
    console.error("[chat/read] fatal", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}