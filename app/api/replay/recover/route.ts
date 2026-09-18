import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { recoverEvent } from "@/lib/recovery/recovery.engine";

export const GET = withSecurity(
  async (req, _ctx) => {
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ success: false, error: "Missing eventId" }, { status: 400 });
    const result = await recoverEvent(eventId);
    return NextResponse.json({ success: true, recovery: result });
  },
  { requireAuth: true, requireRole: ["admin"], rateLimit: RATE_LIMITS.authenticated }
);