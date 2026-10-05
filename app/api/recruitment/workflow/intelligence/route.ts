import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { getCandidateIntelligence } from "@/lib/workflow.intelligence";

const Schema = z.object({ candidateId: z.string().uuid() });

export const POST = withSecurity(
  async (_req, { body }) => {
    const intelligence = await getCandidateIntelligence(body.candidateId);
    return NextResponse.json({ success: true, candidateId: body.candidateId, intelligence });
  },
  { schema: Schema, requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);