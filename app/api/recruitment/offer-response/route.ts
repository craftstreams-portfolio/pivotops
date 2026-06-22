import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOnboardingUser } from "@/lib/onboarding/onboarding.engine";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const COMPLIANCE_DOCS = ["Resume / CV","Nursing License","Driver's License","Flu Shot Record","COVID-19 Vaccination","Hepatitis B Record","MMR Vaccination","Chest X-Ray","BLS / CPR Certification","Drug Screening Results","Background Check"];

function htmlPage(title: string, message: string, color: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f4f4f5; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 440px;
            text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 22px; color: #18181b; margin: 0 0 12px; }
    p { font-size: 15px; color: #71717a; line-height: 1.6; margin: 0; }
    .badge { display: inline-block; margin-top: 20px; padding: 6px 16px; border-radius: 999px;
             font-size: 13px; font-weight: 600; background: #f4f4f5; color: #71717a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="badge">PivotOps</div>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const action = req.nextUrl.searchParams.get("action");

  if (!token || !["accept", "decline"].includes(action ?? "")) {
    return htmlPage("Invalid Link", "This link is invalid or has already been used.", "#ef4444");
  }

  const admin = getAdmin();

  const { data: candidate, error } = await admin
    .from("candidates")
    .select("*")
    .eq("offer_token", token)
    .maybeSingle();

  if (error || !candidate) {
    return htmlPage(
      "Link Expired",
      "This link has already been used or is no longer valid. Please contact your recruiter if you need assistance.",
      "#f59e0b"
    );
  }

  const now = new Date().toISOString();
  const tenantId = candidate.tenant_id;
  const candidateId = candidate.id;

  await admin.from("candidates").update({ offer_token: null }).eq("id", candidateId);

  if (action === "accept") {
    await admin.from("candidates").update({
      status: "hired",
      decision: "STRONG_HIRE",
      offer_accepted_at: now,
      hired_at: now,
      updated_at: now,
    }).eq("id", candidateId);

    try {
      await createOnboardingUser(admin, {
        candidate_id: candidateId,
        name: candidate.name,
        email: candidate.email,
        department: candidate.department ?? null,
        status: "pending",
      });
    } catch (err) {
      console.error("[offer-response] createOnboardingUser failed", err);
    }

    for (const docName of COMPLIANCE_DOCS) {
      try {
        const { data: existing } = await admin.from("compliance_docs").select("id")
          .eq("candidate_id", candidateId).eq("name", docName).limit(1);
        if (!existing || existing.length === 0) {
          await admin.from("compliance_docs").insert({
            tenant_id: tenantId, candidate_id: candidateId, name: docName,
            employee_name: candidate.name, status: "pending", created_at: now, updated_at: now,
          });
        }
      } catch {}
    }

    return htmlPage(
      "Offer Accepted",
      `Thank you, ${candidate.name ?? ""}! Your acceptance has been recorded and your onboarding has been initiated. You will receive further instructions shortly.`,
      "#16a34a"
    );
  }

  if (action === "decline") {
    await admin.from("candidates").update({
      status: "rejected",
      decision: "REJECT",
      rejected_at: now,
      rejection_reason: "Candidate declined offer via email link",
      updated_at: now,
    }).eq("id", candidateId);

    return htmlPage(
      "Offer Declined",
      `Thank you for letting us know, ${candidate.name ?? ""}. We are sorry it did not work out this time. Please do not hesitate to apply again in the future.`,
      "#6366f1"
    );
  }

  return htmlPage("Invalid Link", "This link is invalid or has already been used.", "#ef4444");
}