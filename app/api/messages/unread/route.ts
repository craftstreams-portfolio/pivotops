import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { getUnreadCount } from "@/lib/messages/unread";

const Schema = z.object({ channelId: z.string().uuid().optional() });

export const POST = withSecurity(
  async (_req, { auth, body }) => {
    const count = await getUnreadCount(auth!.userId, body.channelId);
    return NextResponse.json({ success: true, unread: count });
  },
  { schema: Schema, requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);