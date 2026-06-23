import { baseLayout, btn, infoBox, h1, p, divider } from "./layout";

// ── 1. Welcome Email ──────────────────────────────────────────────────────────
export function welcomeEmail(params: {
  userName:    string;
  orgName:     string;
  dashboardUrl: string;
  applyLink:   string;
  plan:        string;
}): { subject: string; html: string } {
  return {
    subject: `Welcome to PivotOps, ${params.userName}`,
    html: baseLayout({
      title:   "Welcome to PivotOps",
      preview: "Your 72-hour hiring workflow starts now.",
      content: `
        ${h1("Welcome to PivotOps")}
        ${p(`Hi ${params.userName}, your workspace for <strong>${params.orgName}</strong> is ready.`)}
        ${p("You are now running on the " + params.plan + " plan. Here is what to do next:")}
        ${infoBox([
          { label: "Your Plan",       value: params.plan },
          { label: "Apply Portal",    value: params.applyLink },
          { label: "Dashboard",       value: "pivotops.app/dashboard" },
        ])}
        ${p("Share your apply link with candidates or post it on job boards. Xavier AI will score every application the moment it arrives.")}
        ${btn("Go to Dashboard", params.dashboardUrl)}
        ${divider()}
        ${p("If you have any questions, reply to this email or reach out to support@pivotops.app.", true)}
      `,
    }),
  };
}

// ── 2. Onboarding Complete ────────────────────────────────────────────────────
export function onboardingCompleteEmail(params: {
  userName:    string;
  orgName:     string;
  applyLink:   string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.orgName} is live on PivotOps`,
    html: baseLayout({
      title:   "Onboarding Complete",
      preview: "Your workforce portal is live.",
      content: `
        ${h1("Your workspace is live")}
        ${p(`Hi ${params.userName}, <strong>${params.orgName}</strong> has completed onboarding on PivotOps.`)}
        ${p("Your candidate apply portal is live and ready to receive applications:")}
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">Your Apply Link</p>
          <p style="margin:4px 0 0;font-size:14px;color:#18181b;font-family:monospace;">${params.applyLink}</p>
        </div>
        ${btn("Open Dashboard", params.dashboardUrl)}
      `,
    }),
  };
}

// ── 3. Team Invite ────────────────────────────────────────────────────────────
export function teamInviteEmail(params: {
  inviteeName: string;
  inviterName: string;
  orgName:     string;
  role:        string;
  acceptUrl:   string;
  expiresIn:   string;
}): { subject: string; html: string } {
  return {
    subject: `${params.inviterName} invited you to join ${params.orgName} on PivotOps`,
    html: baseLayout({
      title:   "Team Invitation",
      preview: `You have been invited to join ${params.orgName}.`,
      content: `
        ${h1("You have been invited")}
        ${p(`Hi ${params.inviteeName}, <strong>${params.inviterName}</strong> has invited you to join <strong>${params.orgName}</strong> on PivotOps as <strong>${params.role}</strong>.`)}
        ${p("PivotOps is an AI-powered workforce operations platform that automates hiring, onboarding, and team coordination.")}
        <div style="margin:28px 0;">
          ${btn("Accept Invitation", params.acceptUrl)}
        </div>
        ${p(`This invitation expires in ${params.expiresIn}. If you did not expect this email, you can safely ignore it.`, true)}
      `,
    }),
  };
}

// ── 4. Candidate Application Received ────────────────────────────────────────
export function applicationReceivedEmail(params: {
  candidateName: string;
  roleName:      string;
  orgName:       string;
  referenceId:   string;
}): { subject: string; html: string } {
  return {
    subject: `Application received — ${params.roleName} at ${params.orgName}`,
    html: baseLayout({
      title:   "Application Received",
      preview: "We have received your application.",
      content: `
        ${h1("Application received")}
        ${p(`Hi ${params.candidateName}, thank you for applying for <strong>${params.roleName}</strong> at <strong>${params.orgName}</strong>.`)}
        ${p("Your application has been received and is being reviewed by our AI scoring system. You will hear from us shortly.")}
        ${infoBox([
          { label: "Position",     value: params.roleName },
          { label: "Company",      value: params.orgName },
          { label: "Reference ID", value: params.referenceId },
        ])}
        ${p("There is nothing more you need to do right now. We will be in touch with next steps.", true)}
      `,
    }),
  };
}

// ── 5. Interview Scheduled ────────────────────────────────────────────────────
export function interviewScheduledEmail(params: {
  candidateName: string;
  roleName:      string;
  orgName:       string;
  scheduledTime: string;
  timezone:      string;
  confirmUrl:    string;
}): { subject: string; html: string } {
  return {
    subject: `Interview scheduled — ${params.roleName} at ${params.orgName}`,
    html: baseLayout({
      title:   "Interview Scheduled",
      preview: "Your interview has been scheduled.",
      accentColor: "#6366f1",
      content: `
        ${h1("Interview scheduled", "#6366f1")}
        ${p(`Hi ${params.candidateName}, congratulations — you have been selected for an interview for <strong>${params.roleName}</strong> at <strong>${params.orgName}</strong>.`)}
        ${infoBox([
          { label: "Position",   value: params.roleName },
          { label: "Date & Time", value: params.scheduledTime },
          { label: "Timezone",   value: params.timezone },
          { label: "Format",     value: "Video Interview" },
        ])}
        <div style="margin:28px 0;">
          ${btn("View Interview Details", params.confirmUrl, "#6366f1")}
        </div>
        ${p("This link is unique to you. Please keep it private and do not share it.", true)}
        ${p("If you need to reschedule, please reply to this email as soon as possible.", true)}
      `,
    }),
  };
}

// ── 6. Offer Letter ───────────────────────────────────────────────────────────
export function offerLetterEmail(params: {
  candidateName: string;
  roleName:      string;
  orgName:       string;
  startDate?:    string;
  notes?:        string;
  acceptUrl:     string;
  declineUrl:    string;
  expiresIn:     string;
}): { subject: string; html: string } {
  return {
    subject: `Offer of Employment — ${params.roleName} at ${params.orgName}`,
    html: baseLayout({
      title:   "Offer of Employment",
      preview: `You have received an offer for ${params.roleName}.`,
      accentColor: "#16a34a",
      content: `
        ${h1("Offer of Employment")}
        ${p(`Dear ${params.candidateName}, we are pleased to offer you the position of <strong>${params.roleName}</strong> at <strong>${params.orgName}</strong>.`)}
        ${infoBox([
          { label: "Position",   value: params.roleName },
          { label: "Company",    value: params.orgName },
          ...(params.startDate ? [{ label: "Start Date", value: params.startDate }] : []),
          { label: "Offer Expires", value: params.expiresIn },
        ])}
        ${params.notes ? p(params.notes) : ""}
        <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
          <tr>
            <td style="padding-right:12px;">
              ${btn("Accept Offer", params.acceptUrl, "#16a34a")}
            </td>
            <td>
              <a href="${params.declineUrl}" style="display:inline-block;padding:13px 28px;background:#ffffff;color:#71717a;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;border:1px solid #e4e4e7;">Decline</a>
            </td>
          </tr>
        </table>
        ${p("These links are unique to you and will expire after use. If you have any questions, please reply to this email.", true)}
      `,
    }),
  };
}

// ── 7. Offer Accepted ─────────────────────────────────────────────────────────
export function offerAcceptedEmail(params: {
  candidateName: string;
  roleName:      string;
  orgName:       string;
  dashboardUrl:  string;
}): { subject: string; html: string } {
  return {
    subject: `Offer accepted — ${params.candidateName} for ${params.roleName}`,
    html: baseLayout({
      title:   "Offer Accepted",
      preview: `${params.candidateName} has accepted the offer.`,
      accentColor: "#16a34a",
      content: `
        ${h1("Offer accepted", "#16a34a")}
        ${p(`<strong>${params.candidateName}</strong> has accepted the offer for <strong>${params.roleName}</strong>.`)}
        ${p("Onboarding has been triggered automatically. Check the dashboard to review their onboarding progress.")}
        <div style="margin:28px 0;">
          ${btn("View in Dashboard", params.dashboardUrl, "#16a34a")}
        </div>
      `,
    }),
  };
}

// ── 8. Offer Declined ─────────────────────────────────────────────────────────
export function offerDeclinedEmail(params: {
  candidateName: string;
  roleName:      string;
  orgName:       string;
  dashboardUrl:  string;
}): { subject: string; html: string } {
  return {
    subject: `Offer declined — ${params.candidateName} for ${params.roleName}`,
    html: baseLayout({
      title:   "Offer Declined",
      preview: `${params.candidateName} has declined the offer.`,
      content: `
        ${h1("Offer declined")}
        ${p(`<strong>${params.candidateName}</strong> has declined the offer for <strong>${params.roleName}</strong>.`)}
        ${p("The role has been returned to your active pipeline. You can view other candidates in the dashboard.")}
        <div style="margin:28px 0;">
          ${btn("View Pipeline", params.dashboardUrl)}
        </div>
      `,
    }),
  };
}

// ── 9. Rejection Email ────────────────────────────────────────────────────────
export function rejectionEmail(params: {
  candidateName: string;
  roleName:      string;
  orgName:       string;
}): { subject: string; html: string } {
  return {
    subject: `Your application for ${params.roleName} — ${params.orgName}`,
    html: baseLayout({
      title:   "Application Update",
      preview: "An update on your application.",
      content: `
        ${h1("Thank you for applying")}
        ${p(`Dear ${params.candidateName}, thank you for taking the time to apply for <strong>${params.roleName}</strong> at <strong>${params.orgName}</strong>.`)}
        ${p("After careful consideration, we will not be moving forward with your application at this time. We appreciate the effort you put into your application and encourage you to apply for future opportunities.")}
        ${p("We wish you the very best in your career journey.", true)}
      `,
      footer: `${params.orgName} powered by PivotOps &bull; <a href="https://www.pivotops.app" style="color:#a1a1aa;">pivotops.app</a>`,
    }),
  };
}

// ── 10. Subscription Confirmation ─────────────────────────────────────────────
export function subscriptionConfirmedEmail(params: {
  userName:    string;
  orgName:     string;
  plan:        string;
  amount:      string;
  billingCycle: string;
  nextBillingDate: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Subscription confirmed — ${params.plan} plan`,
    html: baseLayout({
      title:   "Subscription Confirmed",
      preview: `Your ${params.plan} subscription is active.`,
      accentColor: "#10b981",
      content: `
        ${h1("Subscription confirmed")}
        ${p(`Hi ${params.userName}, your <strong>${params.plan}</strong> subscription for <strong>${params.orgName}</strong> is now active.`)}
        ${infoBox([
          { label: "Plan",           value: params.plan },
          { label: "Amount",         value: params.amount },
          { label: "Billing Cycle",  value: params.billingCycle },
          { label: "Next Billing",   value: params.nextBillingDate },
        ])}
        ${p("You have full access to all features included in your plan. Visit the dashboard to get started.")}
        <div style="margin:28px 0;">
          ${btn("Go to Dashboard", params.dashboardUrl)}
        </div>
        ${p("For billing questions, contact billing@pivotops.app.", true)}
      `,
    }),
  };
}

// ── 11. Plan Upgraded ─────────────────────────────────────────────────────────
export function planUpgradedEmail(params: {
  userName:     string;
  orgName:      string;
  fromPlan:     string;
  toPlan:       string;
  newAmount:    string;
  effectiveDate: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Plan upgraded to ${params.toPlan}`,
    html: baseLayout({
      title:   "Plan Upgraded",
      preview: `Your plan has been upgraded to ${params.toPlan}.`,
      accentColor: "#10b981",
      content: `
        ${h1("Plan upgraded")}
        ${p(`Hi ${params.userName}, your PivotOps plan for <strong>${params.orgName}</strong> has been upgraded.`)}
        ${infoBox([
          { label: "Previous Plan",  value: params.fromPlan },
          { label: "New Plan",       value: params.toPlan },
          { label: "New Amount",     value: params.newAmount },
          { label: "Effective",      value: params.effectiveDate },
        ])}
        ${p("Your new features are active immediately. Enjoy the upgrade.")}
        <div style="margin:28px 0;">
          ${btn("Explore New Features", params.dashboardUrl)}
        </div>
      `,
    }),
  };
}

// ── 12. Plan Downgraded ───────────────────────────────────────────────────────
export function planDowngradedEmail(params: {
  userName:     string;
  orgName:      string;
  fromPlan:     string;
  toPlan:       string;
  newAmount:    string;
  effectiveDate: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Plan changed to ${params.toPlan}`,
    html: baseLayout({
      title:   "Plan Changed",
      preview: `Your plan has been changed to ${params.toPlan}.`,
      content: `
        ${h1("Plan changed")}
        ${p(`Hi ${params.userName}, your PivotOps plan for <strong>${params.orgName}</strong> has been changed.`)}
        ${infoBox([
          { label: "Previous Plan",  value: params.fromPlan },
          { label: "New Plan",       value: params.toPlan },
          { label: "New Amount",     value: params.newAmount },
          { label: "Effective",      value: params.effectiveDate },
        ])}
        ${p("Some features from your previous plan may no longer be available. Visit the dashboard to review your current access.")}
        <div style="margin:28px 0;">
          ${btn("View Dashboard", params.dashboardUrl)}
        </div>
        ${p("To upgrade at any time, visit Settings > Billing in your dashboard.", true)}
      `,
    }),
  };
}

// ── 13. Payment Failed ────────────────────────────────────────────────────────
export function paymentFailedEmail(params: {
  userName:     string;
  orgName:      string;
  amount:       string;
  retryDate:    string;
  updateBillingUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Action required: Payment failed for PivotOps",
    html: baseLayout({
      title:   "Payment Failed",
      preview: "Your payment could not be processed.",
      accentColor: "#ef4444",
      content: `
        ${h1("Payment failed", "#ef4444")}
        ${p(`Hi ${params.userName}, we were unable to process your payment of <strong>${params.amount}</strong> for <strong>${params.orgName}</strong>.`)}
        ${p("Please update your payment details to avoid service interruption. We will retry the payment automatically on <strong>" + params.retryDate + "</strong>.")}
        <div style="margin:28px 0;">
          ${btn("Update Payment Details", params.updateBillingUrl, "#ef4444")}
        </div>
        ${p("If your account is not updated before the retry date, access to PivotOps may be suspended.", true)}
        ${p("For billing assistance, contact billing@pivotops.app.", true)}
      `,
    }),
  };
}

// ── 14. Account Suspended ─────────────────────────────────────────────────────
export function accountSuspendedEmail(params: {
  userName:     string;
  orgName:      string;
  reason:       string;
  contactUrl:   string;
}): { subject: string; html: string } {
  return {
    subject: "Your PivotOps account has been suspended",
    html: baseLayout({
      title:   "Account Suspended",
      preview: "Your account access has been suspended.",
      accentColor: "#ef4444",
      content: `
        ${h1("Account suspended")}
        ${p(`Hi ${params.userName}, access to your PivotOps workspace for <strong>${params.orgName}</strong> has been suspended.`)}
        ${infoBox([{ label: "Reason", value: params.reason }])}
        ${p("To restore access, please contact our support team.")}
        <div style="margin:28px 0;">
          ${btn("Contact Support", params.contactUrl, "#ef4444")}
        </div>
        ${p("Your data is retained and will be available upon account reinstatement.", true)}
      `,
    }),
  };
}

// ── 15. Compliance Document Reminder ─────────────────────────────────────────
export function complianceReminderEmail(params: {
  employeeName:  string;
  orgName:       string;
  missingDocs:   string[];
  portalUrl:     string;
  deadline:      string;
}): { subject: string; html: string } {
  const docList = params.missingDocs.map(d =>
    `<li style="font-size:14px;color:#3f3f46;line-height:2;">${d}</li>`
  ).join("");
  return {
    subject: `Action required: Missing compliance documents — ${params.orgName}`,
    html: baseLayout({
      title:   "Compliance Documents Required",
      preview: "You have missing compliance documents.",
      accentColor: "#f59e0b",
      content: `
        ${h1("Compliance documents required")}
        ${p(`Hi ${params.employeeName}, the following compliance documents are required by <strong>${params.deadline}</strong> for <strong>${params.orgName}</strong>:`)}
        <ul style="margin:16px 0;padding-left:20px;">${docList}</ul>
        ${p("Please upload these documents to your compliance portal as soon as possible.")}
        <div style="margin:28px 0;">
          ${btn("Upload Documents", params.portalUrl, "#f59e0b")}
        </div>
        ${p("Failure to upload required documents may affect your employment status.", true)}
      `,
    }),
  };
}

// ── 16. Password Reset (custom override) ──────────────────────────────────────
export function passwordResetEmail(params: {
  userName:  string;
  resetUrl:  string;
  expiresIn: string;
}): { subject: string; html: string } {
  return {
    subject: "Reset your PivotOps password",
    html: baseLayout({
      title:   "Password Reset",
      preview: "You requested a password reset.",
      content: `
        ${h1("Reset your password")}
        ${p(`Hi ${params.userName}, we received a request to reset your PivotOps password.`)}
        <div style="margin:28px 0;">
          ${btn("Reset Password", params.resetUrl)}
        </div>
        ${p(`This link expires in ${params.expiresIn}. If you did not request a password reset, you can safely ignore this email.`, true)}
      `,
    }),
  };
}