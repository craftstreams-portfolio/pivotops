/**
 * EMAIL SERVICE
 * Currently stubs to console.log — wire to Resend / SendGrid / Supabase Edge Functions
 * when ready. Replace each function body with your email provider's SDK call.
 */

export interface RejectionEmailPayload {
  toEmail:       string;
  candidateName: string;
  role:          string;
  score:         number;
  summary:       string;
}

export interface OfferLetterPayload {
  toEmail:       string;
  candidateName: string;
  role:          string;
  department:    string;
  salary:        string;
  startDate:     string;
  offerId:       string;
  acceptUrl:     string;
  declineUrl:    string;
}

// ─────────────────────────────────────────
// REJECTION EMAIL
// ─────────────────────────────────────────
export async function sendRejectionEmail(payload: RejectionEmailPayload) {
  const subject = `Your application for ${payload.role} — PivotOps Recruitment`;

  const body = `
Dear ${payload.candidateName},

Thank you for taking the time to apply for the ${payload.role} position.

After careful review of your application, we regret to inform you that we will
not be moving forward with your application at this time.

Our team reviews every application thoroughly, and we appreciate the effort
you put into yours. We encourage you to apply again in the future as new
positions become available.

We wish you the very best in your career journey.

Warm regards,
The Recruitment Team
PivotOps Workforce Platform
  `.trim();

  // TODO: Replace with Resend / SendGrid SDK
  console.log(`[EMAIL · REJECTION] To: ${payload.toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);

  // Example Resend integration (uncomment when ready):
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: "recruitment@pivotops.io",
  //   to:   payload.toEmail,
  //   subject,
  //   text: body,
  // });

  return { sent: true, to: payload.toEmail };
}

// ─────────────────────────────────────────
// OFFER LETTER EMAIL
// ─────────────────────────────────────────
export async function sendOfferLetterEmail(payload: OfferLetterPayload) {
  const subject = `Offer of Employment — ${payload.role} at PivotOps`;

  const body = `
Dear ${payload.candidateName},

We are delighted to offer you the position of ${payload.role} within our
${payload.department} department.

OFFER DETAILS
─────────────
Position:    ${payload.role}
Department:  ${payload.department}
Salary:      ${payload.salary}
Start Date:  ${payload.startDate}

This offer is conditional upon satisfactory completion of reference checks
and documentation requirements.

Please respond using one of the links below:

✅ ACCEPT OFFER:
${payload.acceptUrl}

❌ DECLINE OFFER:
${payload.declineUrl}

This offer expires in 72 hours. If you have any questions, please reply to
this email or contact your recruitment coordinator directly.

We look forward to welcoming you to the team.

Warm regards,
The Recruitment Team
PivotOps Workforce Platform
  `.trim();

  // TODO: Replace with Resend / SendGrid SDK
  console.log(`[EMAIL · OFFER] To: ${payload.toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);

  return { sent: true, to: payload.toEmail };
}

// ─────────────────────────────────────────
// INTERVIEW INVITATION EMAIL
// ─────────────────────────────────────────
export async function sendInterviewInviteEmail(payload: {
  toEmail:       string;
  candidateName: string;
  role:          string;
  interviewDate: string;
  interviewLink: string;
}) {
  const subject = `Interview Invitation — ${payload.role}`;

  const body = `
Dear ${payload.candidateName},

Congratulations! We were impressed with your application for ${payload.role}
and would like to invite you to an interview.

INTERVIEW DETAILS
──────────────────
Date & Time: ${payload.interviewDate}
Format:      Video Call
Link:        ${payload.interviewLink}

Please confirm your attendance by replying to this email.
If the proposed time does not work, let us know and we will arrange an alternative.

We look forward to speaking with you.

Warm regards,
The Recruitment Team
PivotOps Workforce Platform
  `.trim();

  console.log(`[EMAIL · INTERVIEW INVITE] To: ${payload.toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);

  return { sent: true, to: payload.toEmail };
}