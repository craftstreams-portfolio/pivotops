import { getApiAuth, unauthorized } from "@/lib/auth/apiAuth";
import { NextResponse }             from "next/server";
import { processApplication }       from "@/lib/recruitment/scoring.engine";
import { xavierNotify }             from "@/lib/recruitment/xavier.notifications";
import { sendRejectionEmail }       from "@/lib/recruitment/email.service";

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

export async function POST(req: Request) {
  const auth = await getApiAuth(req as any);
  if (!auth) return unauthorized();
  return POST_IMPL(req);
}
async function POST_IMPL(req: Request) {
  try {
    const body = await req.json();

    // ── Validate ──────────────────────────────
    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Full name is required" }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }
    if (!body.role?.trim()) {
      return NextResponse.json({ message: "Role is required" }, { status: 400 });
    }

    // ── Score + create candidate ──────────────
    const { candidateId, result } = await processApplication({
      name:             body.name.trim(),
      email:            body.email.trim(),
      phone:            body.phone?.trim()            ?? "",
      linkedin_url:     body.linkedin_url?.trim()     ?? "",
      role:             body.role.trim(),
      years_experience: Number(body.years_experience) || 0,
      current_employer: body.current_employer?.trim() ?? "",
      cover_letter:     body.cover_letter?.trim()     ?? "",
      resume_url:       body.resume_url               ?? null,
      resume_name:      body.resume_name              ?? null,
      tenant_id:        body.tenant_id,
    });

    const tenantId    = body.tenant_id ?? "default";
    const candidateName = body.name.trim();

    // ── Xavier: application received ─────────
    await xavierNotify({
      tenantId,
      candidateId,
      stage:         "application_received",
      candidateName,
      score:         result.score,
    });

    // ── Route based on decision ───────────────
    if (result.decision === "auto_interview") {
      await xavierNotify({
        tenantId,
        candidateId,
        stage:         "auto_interview",
        candidateName,
        score:         result.score,
      });

    } else if (result.decision === "manual_review") {
      await xavierNotify({
        tenantId,
        candidateId,
        stage:         "manual_review",
        candidateName,
        score:         result.score,
      });

    } else {
      // auto_reject — send rejection email
      await xavierNotify({
        tenantId,
        candidateId,
        stage:         "auto_reject",
        candidateName,
        score:         result.score,
      });

      // Fire-and-forget rejection email (don't fail the request if email fails)
      sendRejectionEmail({
        toEmail:       body.email.trim(),
        candidateName,
        role:          body.role.trim(),
        score:         result.score,
        summary:       result.summary,
      }).catch((err: unknown) => {
        console.error("Rejection email failed:", extractMessage(err));
      });
    }

    return NextResponse.json({
      candidateId,
      score:    result.score,
      decision: result.decision,
      message:  result.summary,
    });

  } catch (err) {
    const msg = extractMessage(err);
    console.error("Application route failed:", msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}