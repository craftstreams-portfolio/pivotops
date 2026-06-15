import { supabase } from "../supabase";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export type NotificationStage =
  | "application_received"
  | "auto_interview"
  | "manual_review"
  | "auto_reject"
  | "interview_scheduled"
  | "interview_approved"
  | "interview_rejected"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "onboarding_triggered"
  | "onboarding_complete"
  | "compliance_initiated";

type NotificationType = "info" | "success" | "warning" | "alert";

export interface XavierNotificationPayload {
  tenantId:      string;
  candidateId:   string;
  stage:         NotificationStage;
  candidateName: string;
  score?:        number;
  extra?:        string;
}

// ─────────────────────────────────────────
// CHANNEL IDS
// ─────────────────────────────────────────
const CHANNEL_CANDIDATES         = "8a426d76-42a5-447b-a39b-7a9ea39f6a87";
const CHANNEL_RECRUITMENT_REVIEW = "1da7f9fa-7f21-4557-bc59-7b0cb2a53b63";

// ─────────────────────────────────────────
// STAGE → CHANNEL ROUTING
// ─────────────────────────────────────────
function resolveChannel(stage: NotificationStage): string | null {
  switch (stage) {
    case "application_received":
      return CHANNEL_CANDIDATES;
    case "auto_interview":
      return CHANNEL_CANDIDATES;
    case "manual_review":
      return CHANNEL_RECRUITMENT_REVIEW;
    case "auto_reject":
      return CHANNEL_RECRUITMENT_REVIEW;
    case "interview_scheduled":
    case "interview_approved":
    case "interview_rejected":
    case "offer_sent":
    case "offer_accepted":
    case "offer_declined":
    case "onboarding_triggered":
    case "onboarding_complete":
    case "compliance_initiated":
      return CHANNEL_CANDIDATES;
    default:
      return null;
  }
}

// ─────────────────────────────────────────
// MESSAGE TEMPLATES
// ─────────────────────────────────────────
function buildMessage(
  stage:  NotificationStage,
  name:   string,
  score?: number,
  extra?: string
): { message: string; type: NotificationType } {
  switch (stage) {
    case "application_received":
      return { type: "info",    message: `🤖 Xavier AI · New application received from **${name}**. Scoring in progress...` };
    case "auto_interview":
      return { type: "success", message: `✅ Xavier AI · **${name}** scored ${score}/100 — above interview threshold. Automatically moved to interview stage.` };
    case "manual_review":
      return { type: "warning", message: `🟡 Xavier AI · **${name}** scored ${score}/100 — routed to Recruitment Review. Please assess within 48 hours.` };
    case "auto_reject":
      return { type: "alert",   message: `❌ Xavier AI · **${name}** scored ${score}/100 — below minimum threshold. Automatic rejection email sent.` };
    case "interview_scheduled":
      return { type: "info",    message: `📅 Xavier AI · Interview scheduled for **${name}**. ${extra ?? ""}` };
    case "interview_approved":
      return { type: "success", message: `🎯 Xavier AI · **${name}** approved post-interview. Offer letter sent to candidate.` };
    case "interview_rejected":
      return { type: "alert",   message: `❌ Xavier AI · **${name}** was not selected after interview.${extra ? ` Reason: ${extra}` : ""}` };
    case "offer_sent":
      return { type: "info",    message: `📨 Xavier AI · Offer letter sent to **${name}**. Awaiting candidate response.` };
    case "offer_accepted":
      return { type: "success", message: `🎉 Xavier AI · **${name}** accepted the offer! Onboarding and compliance triggered automatically.` };
    case "offer_declined":
      return { type: "warning", message: `⚠️ Xavier AI · **${name}** declined the offer.${extra ? ` Reason: "${extra}"` : ""} Candidate archived.` };
    case "onboarding_triggered":
      return { type: "success", message: `🚀 Xavier AI · Onboarding profile created for **${name}**. HR notified. Compliance documents initiated.` };
    case "onboarding_complete":
      return { type: "success", message: `✅ Xavier AI · **${name}** completed onboarding. Employee profile now active.` };
    case "compliance_initiated":
      return { type: "info",    message: `🛡️ Xavier AI · Compliance checklist initiated for **${name}**. Required: ID, contract, equipment, training.` };
    default:
      return { type: "info",    message: `Xavier AI · Update for ${name}` };
  }
}

// ─────────────────────────────────────────
// SAVE TO xavier_notifications TABLE
// ─────────────────────────────────────────
async function saveNotification(
  tenantId:    string,
  candidateId: string,
  stage:       NotificationStage,
  message:     string,
  type:        NotificationType
) {
  const { error } = await supabase.from("xavier_notifications").insert({
    tenant_id:    tenantId,
    candidate_id: candidateId,
    stage,
    message,
    type,
    read:         false,
    created_at:   new Date().toISOString(),
  });
  if (error) {
    console.error("Xavier notification save failed:", error.message ?? error);
  }
}

// ─────────────────────────────────────────
// POST TO CHANNEL
// Uses the anon supabase client so Supabase Realtime
// broadcasts the insert to all subscribers in real time.
// RLS policy "Allow Xavier AI system inserts" permits this.
// ─────────────────────────────────────────
async function postToChannel(
  channelId: string,
  message:   string,
  tenantId:  string
) {
  try {
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      content:    message,
      user_id:    "null",
      user_name:  "Xavier AI",
      tenant_id:  tenantId,
      type:       "system",
      retracted:  false,
      reactions:  {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[Xavier] channel post failed:", error.message ?? error);
    }
  } catch (err) {
    console.error("[Xavier] channel post exception:", err instanceof Error ? err.message : err);
  }
}

// ─────────────────────────────────────────
// MAIN NOTIFY — called at every stage
// ─────────────────────────────────────────
export async function xavierNotify(payload: XavierNotificationPayload) {
  const { tenantId, candidateId, stage, candidateName, score, extra } = payload;
  const { message, type } = buildMessage(stage, candidateName, score, extra);

  // 1. Save to xavier_notifications table
  await saveNotification(tenantId, candidateId, stage, message, type);

  // 2. Route to the correct channel
  const channelId = resolveChannel(stage);
  if (channelId) {
    await postToChannel(channelId, message, tenantId);
  }

  return { message, type };
}

// ─────────────────────────────────────────
// GET NOTIFICATIONS
// ─────────────────────────────────────────
export async function getXavierNotifications(tenantId: string, limit = 50) {
  const { data, error } = await supabase
    .from("xavier_notifications")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch Xavier notifications:", error.message ?? error);
    return [];
  }
  return data ?? [];
}

// ─────────────────────────────────────────
// MARK ALL READ
// ─────────────────────────────────────────
export async function markNotificationsRead(tenantId: string) {
  await supabase
    .from("xavier_notifications")
    .update({ read: true })
    .eq("tenant_id", tenantId)
    .eq("read", false);
}