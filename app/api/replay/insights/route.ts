import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { analyzeReplay } from "../../../../lib/replay/replay.ai";

export const GET = withSecurity(
  async (req, _ctx) => {
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ success: false, error: "Missing eventId" }, { status: 400 });
    const insight = await analyzeReplay(eventId);
    return NextResponse.json({ success: true, data: insight });
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);