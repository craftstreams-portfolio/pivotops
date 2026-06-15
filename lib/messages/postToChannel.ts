import { supabase } from "@/lib/supabase";
import { markMessageUnread } from "@/lib/messages/unread";

/**
 * ─────────────────────────────────────────────
 * POST MESSAGE TO CHANNEL (PivotOps Messaging Core)
 * ─────────────────────────────────────────────
 *
 * - Creates system/user messages
 * - Auto-tracks unread state (Telegram-style)
 * - Safe for Xavier AI + recruiter actions
 */

export type PostToChannelInput = {
  channelId: string;
  content: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  type?: "system" | "user";
  meta?: Record<string, any>;
};

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const SYSTEM_USER_NAME = "Xavier AI";

/**
 * MAIN FUNCTION
 */
export async function postToChannel({
  channelId,
  content,
  tenantId,
  userId,
  userName,
  type = "system",
  meta,
}: PostToChannelInput) {
  const senderId = userId ?? SYSTEM_USER_ID;
  const senderName = userName ?? SYSTEM_USER_NAME;

  // ─────────────────────────────────────────
  // 1. INSERT MESSAGE
  // ─────────────────────────────────────────
  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id: channelId,
      content,
      user_id: senderId,
      user_name: senderName,
      tenant_id: tenantId,
      type,
      retracted: false,
      reactions: {},
      meta: meta ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[postToChannel] insert failed:", error.message ?? error);
    return null;
  }

  // ─────────────────────────────────────────
  // 2. UNREAD TRACKING (TELEGRAM STYLE)
  // ─────────────────────────────────────────
  try {
    await markMessageUnread(data.id, senderId, tenantId);
  } catch (err) {
    console.error("[postToChannel] unread update failed:", err);
  }

  return data;
}