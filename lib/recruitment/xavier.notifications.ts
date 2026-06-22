import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

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

// Channels are tenant-scoped, so they can never be hardcoded global IDs --
// each tenant gets its own "Candidates" / "Recruitment Review" channel,
// created on first use and reused after that. If a concurrent call wins
// the insert race first, we fall back to a re-select instead of failing.
export async function getOrCreateChannel(tenantId: string, name: string): Promise<string> {
  const { data: existing } = await supabase
    .from("channels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("channels")
    .insert({ name, tenant_id: tenantId })
    .select("id")
    .single();

  if (!error && created) return created.id;

  const { data: retry } = await supabase
    .from("channels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .maybeSingle();
  if (retry) return retry.id;

  console.error("Failed to create channel \"" + name + "\" for tenant " + tenantId + ":", error?.message ?? "unknown error");
  throw new Error(error?.message ?? ("Unable to resolve channel \"" + name + "\""));
}

async function resolveChannel(stage: NotificationStage, tenantId: string): Promise<string | null> {
  switch (stage) {
    case "application_received":
      // Handled exclusively by postCandidateCard's rich interactive card
      // in apply/route.ts -- posting here too would just be a duplicate,
      // failure-prone announcement of the same event.
      return null;
    case "manual_review":
    case "auto_reject":
      return getOrCreateChannel(tenantId, "Recruitment Review");
    case "auto_interview":
    case "interview_scheduled":
    case "interview_approved":
    case "interview_rejected":
    case "offer_sent":
    case "offer_accepted":
    case "offer_declined":
    case "onboarding_triggered":
    case "onboarding_complete":
    case "compliance_initiated":
      return getOrCreateChannel(tenantId, "Candidates");
    default:
      return null;
  }
}

function buildMessage(
  stage:  NotificationStage,
  name:   string,
  score?: number,
  extra?: string
): { message: string; type: NotificationType } {
  switch (stage) {
    case "application_received":
      return { type: "info",    message: "[Xavier AI] New application received from **" + name + "**. Scoring in progress..." };
    case "auto_interview":
      return { type: "success", message: "[Xavier AI] **" + name + "** scored " + score + "/100 - above interview threshold. Automatically moved to interview stage." };
    case "manual_review":
      return { type: "warning", message: "[Xavier AI] **" + name + "** scored " + score + "/100 - routed to Recruitment Review. Please assess within 48 hours." };
    case "auto_reject":
      return { type: "alert",   message: "[Xavier AI] **" + name + "** scored " + score + "/100 - below minimum threshold. Automatic rejection email sent." };
    case "interview_scheduled":
      return { type: "info",    message: "[Xavier AI] Interview scheduled for **" + name + "**. " + (extra ?? "") };
    case "interview_approved":
      return { type: "success", message: "[Xavier AI] **" + name + "** approved post-interview. Offer letter sent to candidate." };
    case "interview_rejected":
      return { type: "alert",   message: "[Xavier AI] **" + name + "** was not selected after interview." + (extra ? " Reason: " + extra : "") };
    case "offer_sent":
      return { type: "info",    message: "[Xavier AI] Offer letter sent to **" + name + "**. Awaiting candidate response." };
    case "offer_accepted":
      return { type: "success", message: "[Xavier AI] **" + name + "** accepted the offer! Onboarding and compliance triggered automatically." };
    case "offer_declined":
      return { type: "warning", message: "[Xavier AI] **" + name + "** declined the offer." + (extra ? " Reason: \"" + extra + "\"" : "") + " Candidate archived." };
    case "onboarding_triggered":
      return { type: "success", message: "[Xavier AI] Onboarding profile created for **" + name + "**. HR notified. Compliance documents initiated." };
    case "onboarding_complete":
      return { type: "success", message: "[Xavier AI] **" + name + "** completed onboarding. Employee profile now active." };
    case "compliance_initiated":
      return { type: "info",    message: "[Xavier AI] Compliance checklist initiated for **" + name + "**. Required: ID, contract, equipment, training." };
    default:
      return { type: "info",    message: "[Xavier AI] Update for " + name };
  }
}

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

async function postToChannel(
  channelId: string,
  message:   string,
  tenantId:  string
) {
  try {
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      content:    message,
      user_id:    null,
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

export async function xavierNotify(payload: XavierNotificationPayload) {
  const { tenantId, candidateId, stage, candidateName, score, extra } = payload;
  const { message, type } = buildMessage(stage, candidateName, score, extra);

  await saveNotification(tenantId, candidateId, stage, message, type);

  const channelId = await resolveChannel(stage, tenantId);
  if (channelId) {
    await postToChannel(channelId, message, tenantId);
  }

  return { message, type };
}

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

export async function markNotificationsRead(tenantId: string) {
  await supabase
    .from("xavier_notifications")
    .update({ read: true })
    .eq("tenant_id", tenantId)
    .eq("read", false);
}