import { NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { OnboardingSchema, OnboardingInput } from "@/lib/security/schemas";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { supabase } from "@/lib/supabase";
import { createOnboardingUser } from "@/lib/onboarding/onboarding.engine";
export const POST = withSecurity<OnboardingInput>(
  async (_req, { auth, body }) => {
    const tenantId = auth!.tenantId;
    const { data: candidate } = await supabase.from("candidates").select("id, name, email, department").eq("id", body.candidateId).eq("tenant_id", tenantId).single();
    if (!candidate) return NextResponse.json({ error: "Candidate not found or not in your tenant." }, { status: 404 });
    const user = await createOnboardingUser(supabase, { candidate_id: body.candidateId, name: candidate.name, email: candidate.email, department: candidate.department ?? null, status: "pending" });
    return NextResponse.json(user);
  },
  { schema: OnboardingSchema, requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);