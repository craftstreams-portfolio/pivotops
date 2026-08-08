import { supabase } from "@/lib/supabase";

/**
 * MARK MESSAGE AS UNREAD FOR ALL USERS EXCEPT SENDER
 */
export async function markMessageUnread(
  messageId: string,
  senderId: string,
  tenantId: string
) {
  const { data: users } = await supabase
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId);

  const read_by: Record<string, boolean> = {};

  for (const u of users ?? []) {
    if (u.id !== senderId) {
      read_by[u.id] = false;
    }
  }

  await supabase
    .from("messages")
    .update({ read_by })
    .eq("id", messageId);
}

/**
 * GET UNREAD COUNT FOR USER (Telegram-style badge)
 */
export async function getUnreadCount(userId: string, channelId?: string) {
  let query = supabase
    .from("messages")
    .select("id, read_by, channel_id");

  if (channelId) {
    query = query.eq("channel_id", channelId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[unread] fetch failed:", error.message);
    return 0;
  }

  let count = 0;

  for (const msg of data ?? []) {
    const readBy = msg.read_by ?? {};

    if (!readBy[userId]) {
      count++;
    }
  }

  return count;
}

/**
 * MARK CHANNEL AS READ (when user opens chat)
 */
export async function markChannelAsRead(
  userId: string,
  channelId: string
) {
  const { data: messages } = await supabase
    .from("messages")
    .select("id, read_by")
    .eq("channel_id", channelId);

  for (const msg of messages ?? []) {
    const readBy = msg.read_by ?? {};

    readBy[userId] = true;

    await supabase
      .from("messages")
      .update({ read_by: readBy })
      .eq("id", msg.id);
  }
}