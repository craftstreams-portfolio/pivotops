import { supabase } from "./supabase";

export async function sendMessage({
  channelId,
  content,
  user_name,
  type = "message",
  meta = {},
}: {
  channelId: string;
  content: string;
  user_name: string;
  type?: string;
  meta?: any;
}) {
  const { error } = await supabase.from("messages").insert({
    channel_id: channelId,
    content,
    user_name,
    type,
    meta,
  });

  if (error) {
    console.error("Message send error:", error.message);
  }
}