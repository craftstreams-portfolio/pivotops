/**
 * HTML email templates for candidate-facing messages.
 */
export function qualificationSummaryEmail(params: {
  candidateName: string;
  roleName: string;
  score: number;
  decision: "auto_interview" | "manual_review" | "auto_reject";
  tenantName: string;
}): { subject: string; html: string } {
  const { candidateName, roleName, score, decision, tenantName } = params;
  const heading =
    decision === "auto_interview"
      ? "You've been shortlisted"
      : decision === "manual_review"
      ? "Your application is under review"
      : "Thank you for applying";
  const body =
    decision === "auto_interview"
      ? `Good news - your application for <strong>${roleName}</strong> at ${tenantName} has been shortlisted. Our team will follow up shortly with next steps, including interview scheduling.`
      : decision === "manual_review"
      ? `Thanks for applying for <strong>${roleName}</strong> at ${tenantName}. Your application is being reviewed by our recruitment team, and we'll be in touch soon.`
      : `Thank you for your interest in <strong>${roleName}</strong> at ${tenantName}. We've reviewed your application and will keep your details on file for future opportunities.`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${heading}</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">Hi ${candidateName},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">${body}</p>
      <p style="font-size: 13px; color: #71717a; margin-top: 24px;">- ${tenantName} recruitment team</p>
    </div>
  `;
  return { subject: `${heading} - ${roleName} at ${tenantName}`, html };
}

export function interviewScheduledEmail(params: {
  candidateName: string;
  roleName: string;
  tenantName: string;
  scheduledTime: string;
  timezone: string;
  confirmUrl: string;
}): { subject: string; html: string } {
  const { candidateName, roleName, tenantName, scheduledTime, timezone, confirmUrl } = params;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Interview Scheduled - ${roleName}</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">Dear ${candidateName},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
        Your interview for <strong>${roleName}</strong> at ${tenantName} has been scheduled.
      </p>
      <div style="margin: 24px 0; padding: 16px 20px; background: #f4f4f5; border-radius: 10px; border-left: 4px solid #6366f1;">
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #18181b;">${scheduledTime}</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #71717a;">${timezone}</p>
      </div>
      <div style="margin: 32px 0;">
        <a href="${confirmUrl}"
           style="display: inline-block; padding: 12px 28px; background: #6366f1; color: #ffffff;
                  text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
          View Interview Details
        </a>
      </div>
      <p style="font-size: 12px; color: #a1a1aa; margin-top: 8px;">
        This link is unique to you. Please keep it private.
      </p>
      <p style="font-size: 13px; color: #71717a; margin-top: 24px;">- ${tenantName} recruitment team</p>
    </div>
  `;
  return { subject: `Interview Scheduled - ${roleName} at ${tenantName}`, html };
}

export function offerLetterEmail(params: {
  candidateName: string;
  roleName: string;
  tenantName: string;
  startDate?: string;
  additionalNotes?: string;
  acceptUrl?: string;
  declineUrl?: string;
}): { subject: string; html: string } {
  const { candidateName, roleName, tenantName, startDate, additionalNotes, acceptUrl, declineUrl } = params;
  const buttons = acceptUrl && declineUrl ? `
    <div style="margin: 32px 0; display: flex; gap: 12px;">
      <a href="${acceptUrl}"
         style="display: inline-block; padding: 12px 28px; background: #16a34a; color: #ffffff;
                text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;
                margin-right: 12px;">
        Accept Offer
      </a>
      <a href="${declineUrl}"
         style="display: inline-block; padding: 12px 28px; background: #ffffff; color: #71717a;
                text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;
                border: 1px solid #e4e4e7;">
        Decline
      </a>
    </div>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 8px;">
      These links are unique to you and will expire once used.
    </p>
  ` : `
    <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Please reply to this email to confirm acceptance, or reach out with any questions.
    </p>
  `;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Offer of Employment - ${roleName}</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">Dear ${candidateName},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
        We're pleased to offer you the position of <strong>${roleName}</strong> at ${tenantName}.
        ${startDate ? `We'd like you to start on <strong>${startDate}</strong>.` : ""}
      </p>
      ${additionalNotes ? `<p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">${additionalNotes}</p>` : ""}
      ${buttons}
      <p style="font-size: 13px; color: #71717a; margin-top: 24px;">- ${tenantName} recruitment team</p>
    </div>
  `;
  return { subject: `Offer of Employment - ${roleName} at ${tenantName}`, html };
}