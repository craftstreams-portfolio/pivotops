/**
 * PivotOps Email Dispatcher
 * Single entry point for all transactional emails.
 * Import this instead of calling sendEmail directly.
 */

import { sendEmail, EMAIL_SENDERS } from "../email";
import * as T from "./templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";

// ── Helpers ───────────────────────────────────────────────────────────────────
function dashboardUrl(path = "") {
  return `${APP_URL}/dashboard${path}`;
}

// ── Dispatchers ───────────────────────────────────────────────────────────────

export async function emailWelcome(params: {
  to:          string;
  userName:    string;
  orgName:     string;
  applyLink:   string;
  plan:        string;
}) {
  const tpl = T.welcomeEmail({
    userName:     params.userName,
    orgName:      params.orgName,
    dashboardUrl: dashboardUrl(),
    applyLink:    params.applyLink,
    plan:         params.plan,
  });
  return sendEmail({
    to:      params.to,
    subject: tpl.subject,
    html:    tpl.html,
    from:    EMAIL_SENDERS.notifications,
    tags:    [{ name: "type", value: "welcome" }],
  });
}

export async function emailOnboardingComplete(params: {
  to:       string;
  userName: string;
  orgName:  string;
  applyLink: string;
}) {
  const tpl = T.onboardingCompleteEmail({
    userName:     params.userName,
    orgName:      params.orgName,
    applyLink:    params.applyLink,
    dashboardUrl: dashboardUrl(),
  });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailTeamInvite(params: {
  to:          string;
  inviteeName: string;
  inviterName: string;
  orgName:     string;
  role:        string;
  acceptUrl:   string;
}) {
  const tpl = T.teamInviteEmail({
    ...params,
    expiresIn: "48 hours",
  });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailApplicationReceived(params: {
  to:            string;
  candidateName: string;
  roleName:      string;
  orgName:       string;
  referenceId:   string;
}) {
  const tpl = T.applicationReceivedEmail(params);
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.noreply });
}

export async function emailInterviewScheduled(params: {
  to:            string;
  candidateName: string;
  roleName:      string;
  orgName:       string;
  scheduledTime: string;
  timezone:      string;
  confirmUrl:    string;
}) {
  const tpl = T.interviewScheduledEmail(params);
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailOfferLetter(params: {
  to:            string;
  candidateName: string;
  roleName:      string;
  orgName:       string;
  startDate?:    string;
  notes?:        string;
  acceptUrl:     string;
  declineUrl:    string;
}) {
  const tpl = T.offerLetterEmail({ ...params, expiresIn: "72 hours" });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailOfferAccepted(params: {
  to:            string;
  candidateName: string;
  roleName:      string;
  orgName:       string;
}) {
  const tpl = T.offerAcceptedEmail({ ...params, dashboardUrl: dashboardUrl("/recruitment") });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailOfferDeclined(params: {
  to:            string;
  candidateName: string;
  roleName:      string;
  orgName:       string;
}) {
  const tpl = T.offerDeclinedEmail({ ...params, dashboardUrl: dashboardUrl("/recruitment") });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailRejection(params: {
  to:            string;
  candidateName: string;
  roleName:      string;
  orgName:       string;
}) {
  const tpl = T.rejectionEmail(params);
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.noreply });
}

export async function emailSubscriptionConfirmed(params: {
  to:              string;
  userName:        string;
  orgName:         string;
  plan:            string;
  amount:          string;
  billingCycle:    string;
  nextBillingDate: string;
}) {
  const tpl = T.subscriptionConfirmedEmail({ ...params, dashboardUrl: dashboardUrl() });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.billing, tags: [{ name: "type", value: "billing" }] });
}

export async function emailPlanUpgraded(params: {
  to:           string;
  userName:     string;
  orgName:      string;
  fromPlan:     string;
  toPlan:       string;
  newAmount:    string;
  effectiveDate: string;
}) {
  const tpl = T.planUpgradedEmail({ ...params, dashboardUrl: dashboardUrl() });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.billing });
}

export async function emailPlanDowngraded(params: {
  to:           string;
  userName:     string;
  orgName:      string;
  fromPlan:     string;
  toPlan:       string;
  newAmount:    string;
  effectiveDate: string;
}) {
  const tpl = T.planDowngradedEmail({ ...params, dashboardUrl: dashboardUrl() });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.billing });
}

export async function emailPaymentFailed(params: {
  to:               string;
  userName:         string;
  orgName:          string;
  amount:           string;
  retryDate:        string;
}) {
  const tpl = T.paymentFailedEmail({
    ...params,
    updateBillingUrl: dashboardUrl("/settings/billing"),
  });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.billing });
}

export async function emailAccountSuspended(params: {
  to:       string;
  userName: string;
  orgName:  string;
  reason:   string;
}) {
  const tpl = T.accountSuspendedEmail({
    ...params,
    contactUrl: `${APP_URL}/support`,
  });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.support });
}

export async function emailComplianceReminder(params: {
  to:           string;
  employeeName: string;
  orgName:      string;
  missingDocs:  string[];
  portalUrl:    string;
  deadline:     string;
}) {
  const tpl = T.complianceReminderEmail(params);
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.notifications });
}

export async function emailPasswordReset(params: {
  to:        string;
  userName:  string;
  resetUrl:  string;
}) {
  const tpl = T.passwordResetEmail({ ...params, expiresIn: "1 hour" });
  return sendEmail({ to: params.to, subject: tpl.subject, html: tpl.html, from: EMAIL_SENDERS.noreply });
}