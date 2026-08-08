import { NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { startWorker } from "../../../lib/workers/start-worker";
export const POST = withSecurity(
  async () => { startWorker(); return NextResponse.json({ ok: true }); },
  { requireAuth: true, requireRole: ["admin"], rateLimit: RATE_LIMITS.internal }
);