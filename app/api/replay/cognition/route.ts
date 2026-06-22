import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { analyzeEventCognition } from "@/lib/ai/event-cognition";

export const GET = withSecurity(
  async (req, _ctx) => {
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ success: false, error: "Missing eventId" }, { status: 400 });
    const report = await analyzeEventCognition(eventId);
    return NextResponse.json({ success: true, report });
  },
  { requireAuth: true, requireRole: ["admin", "manager"], rateLimit: RATE_LIMITS.authenticated }
);