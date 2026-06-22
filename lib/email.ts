/**
 * Minimal transactional email utility via Resend.
 *
 * Requires env vars:
 *   RESEND_API_KEY        - from resend.com dashboard
 *   EMAIL_FROM             - e.g. "PivotOps <notifications@yourdomain.com>"
 *                             (domain must have SPF/DKIM verified in Resend
 *                             before this will deliver to inboxes reliably)
 *
 * This is intentionally minimal - it covers the "send a transactional email"
 * need right now (candidate summary, offer letter). Full Priority 5 scope
 * (welcome email, password reset, invite flows, DMARC) is a separate pass.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

const EMAIL_TIMEOUT_MS = 8000;

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("sendEmail: missing RESEND_API_KEY or EMAIL_FROM env var - email not sent", { to, subject });
    return { ok: false, error: "Email service not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("sendEmail failed", { status: res.status, body, to, subject });
      return { ok: false, error: `Email send failed (${res.status})` };
    }

    return { ok: true };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error(timedOut ? "sendEmail timed out" : "sendEmail threw", err);
    return {
      ok: false,
      error: timedOut
        ? `Email send timed out after ${EMAIL_TIMEOUT_MS}ms`
        : (err instanceof Error ? err.message : "Unknown email error"),
    };
  }
}