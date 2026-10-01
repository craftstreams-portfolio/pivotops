import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { logAudit } from "@/lib/audit";

const WorkflowSchema = z.object({ candidateId: z.string().uuid() });

export const POST = withSecurity(
  async (_req, { auth, body }) => {
    await logAudit({
      tenantId:   auth!.tenantId,
      action:     "recruitment.interview_scheduled",
      userId:     auth!.userId,
      userName:   auth!.email ?? "Recruiter",
      entityType: "candidate",
      entityId:   body.candidateId,
    });
    return NextResponse.json({ success: true });
  },
  { schema: WorkflowSchema, requireAuth: true, requireRole: ["admin", "manager", "recruiter", "operator"], rateLimit: RATE_LIMITS.authenticated }
);