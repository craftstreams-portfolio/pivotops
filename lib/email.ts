/**
 * PivotOps Transactional Email Client
 * Provider: Resend (resend.com)
 * All emails sent from verified domain: pivotops.app
 */

export interface EmailPayload {
  to:       string | string[];
  subject:  string;
  html:     string;
  from?:    string;
  replyTo?: string;
  cc?:      string[];
  bcc?:     string[];
  tags?:    { name: string; value: string }[];
}

export interface EmailResult {
  ok:    boolean;
  id?:   string;
  error?: string;
}

// ── Sender addresses ──────────────────────────────────────────────────────────
export const EMAIL_SENDERS = {
  notifications: "PivotOps <notifications@pivotops.app>",
  support:       "PivotOps Support <support@pivotops.app>",
  billing:       "PivotOps Billing <billing@pivotops.app>",
  noreply:       "PivotOps <noreply@pivotops.app>",
  legal:         "PivotOps Legal <legal@pivotops.app>",
} as const;

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[Email] RESEND_API_KEY not set");
    return { ok: false, error: "Email service not configured" };
  }

  const from = payload.from ?? process.env.EMAIL_FROM ?? EMAIL_SENDERS.notifications;
  const to   = Array.isArray(payload.to) ? payload.to : [payload.to];

  const body = JSON.stringify({
    from,
    to,
    subject:  payload.subject,
    html:     payload.html,
    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    ...(payload.cc      ? { cc: payload.cc }             : {}),
    ...(payload.bcc     ? { bcc: payload.bcc }           : {}),
    ...(payload.tags    ? { tags: payload.tags }         : {}),
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const redacted = to.map(a => { const [u, d] = a.split("@"); return d ? `${u.slice(0,2)}***@${d}` : "***"; });
      console.log(`[Email] Sent "${payload.subject}" to ${redacted.join(", ")} (id: ${data?.id})`);
        return { ok: true, id: data?.id };
      }

      const errBody = await res.text().catch(() => "");
      // 429 rate limit — wait and retry
      if (res.status === 429 && attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
        continue;
      }
      console.error(`[Email] Failed attempt ${attempt}`, { status: res.status, body: errBody });
      if (attempt === MAX_RETRIES) {
        return { ok: false, error: `Send failed (${res.status}): ${errBody}` };
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      console.error(`[Email] ${isTimeout ? "Timeout" : "Error"} attempt ${attempt}`, err);
      if (attempt === MAX_RETRIES) {
        return { ok: false, error: isTimeout ? "Email send timed out" : String(err) };
      }
      await sleep(500 * attempt);
    }
  }

  return { ok: false, error: "Max retries exceeded" };
}