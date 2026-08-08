import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export const POST = withSecurity(
  async (req, { auth }) => {
    const body = await req.json();
    const { channelId } = body;
    if (!channelId) return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    const userId = auth!.userId;
    const now = new Date().toISOString();
    const admin = getAdmin();
    const { error } = await admin.from("channel_members").upsert(
      { channel_id: channelId, user_id: userId, last_read_at: now },
      { onConflict: "channel_id,user_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, channelId, userId, lastReadAt: now });
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);