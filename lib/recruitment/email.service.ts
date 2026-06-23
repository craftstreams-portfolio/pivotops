/**
 * Recruitment Email Service — wired to Resend via lib/email/dispatch.ts
 */
export {
  emailInterviewScheduled  as sendInterviewInviteEmail,
  emailOfferLetter         as sendOfferLetterEmail,
  emailRejection           as sendRejectionEmail,
  emailApplicationReceived as sendApplicationReceivedEmail,
  emailOfferAccepted       as sendOfferAcceptedEmail,
  emailOfferDeclined       as sendOfferDeclinedEmail,
} from "../email/dispatch";