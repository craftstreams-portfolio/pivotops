import { supabase } from "../supabase";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export type MessageType =
  | "text"
  | "file"
  | "voice"
  | "image"
  | "system"
  | "meme";

export interface Message {
  id:             string;
  channel_id:     string;
  user_id:        string | null;
  user_name:      string | null;
  tenant_id:      string | null;
  content:        string | null;
  type:           MessageType;
  retracted:      boolean;
  retracted_by:   string | null;
  retracted_at:   string | null;
  quoted_id:      string | null;
  file_url:       string | null;
  file_name:      string | null;
  file_type:      string | null;
  voice_url:      string | null;
  voice_seconds:  number | null;
  reactions:      Record<string, string[]>; // emoji → user_ids[]
  created_at:     string;
  meta:           Record<string, any> | null;
  pinned:         boolean | null;
  pinned_at:      string | null;
  pinned_by:      string | null;
}

export interface Channel {
  id:         string;
  name:       string;
  tenant_id:  string | null;
  created_at: string;
  created_by: string | null;
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// CHANNELS
// ─────────────────────────────────────────
export async function getChannels(tenantId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load channels: ${extractMessage(error)}`);
  return data ?? [];
}

export async function createChannel(
  name: string,
  tenantId: string,
  userId: string
): Promise<Channel> {
  const { data, error } = await supabase
    .from("channels")
    .insert({
      name:       name.trim(),
      tenant_id:  tenantId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create channel: ${extractMessage(error)}`);
  return data;
}

// ─────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────
export async function getMessages(channelId: string, limit = 100): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to load messages: ${extractMessage(error)}`);
  return (data ?? []).map(normalizeMessage);
}

function normalizeMessage(m: any): Message {
  return {
    id:            m.id,
    channel_id:    m.channel_id,
    user_id:       m.user_id   ?? null,
    user_name:     m.user_name ?? null,
    tenant_id:     m.tenant_id ?? null,
    content:       m.content   ?? null,
    type:          m.type      ?? "text",
    retracted:     m.retracted ?? false,
    retracted_by:  m.retracted_by ?? null,
    retracted_at:  m.retracted_at ?? null,
    quoted_id:     m.quoted_id ?? null,
    file_url:      m.file_url  ?? null,
    file_name:     m.file_name ?? null,
    file_type:     m.file_type ?? null,
    voice_url:     m.voice_url ?? null,
    voice_seconds: m.voice_seconds ?? null,
    reactions:     m.reactions ?? {},
    created_at:    m.created_at,
    meta:          m.meta ?? null,
    pinned:        m.pinned ?? false,
    pinned_at:     m.pinned_at ?? null,
    pinned_by:     m.pinned_by ?? null,
  };
}



// ─────────────────────────────────────────
// SEND TEXT MESSAGE
// ─────────────────────────────────────────
export async function sendTextMessage(payload: {
  channelId:  string;
  content:    string;
  userId:     string;
  userName:   string;
  tenantId:   string;
  quotedId?:  string | null;
}): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id:  payload.channelId,
      content:     payload.content.trim(),
      user_id:     payload.userId,
      user_name:   payload.userName,
      tenant_id:   payload.tenantId,
      type:        "text",
      quoted_id:   payload.quotedId ?? null,
      retracted:   false,
      reactions:   {},
      created_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to send message: ${extractMessage(error)}`);
  return normalizeMessage(data);
}

// ─────────────────────────────────────────
// SEND FILE / IMAGE MESSAGE
// ─────────────────────────────────────────
export async function uploadAndSendFile(payload: {
  channelId: string;
  userId:    string;
  userName:  string;
  tenantId:  string;
  file:      File;
  quotedId?: string | null;
}): Promise<Message> {
  const { file } = payload;
  const isImage  = file.type.startsWith("image/");
  const ext      = file.name.split(".").pop();
  const path     = `chat/${payload.channelId}/${crypto.randomUUID()}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(path, file);

  if (uploadError) {
    throw new Error(`File upload failed: ${extractMessage(uploadError)}`);
  }

  const { data: urlData } = supabase.storage
    .from("chat-media")
    .getPublicUrl(path);

  // Insert message
  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id: payload.channelId,
      user_id:    payload.userId,
      user_name:  payload.userName,
      tenant_id:  payload.tenantId,
      content:    file.name,
      type:       isImage ? "image" : "file",
      file_url:   urlData.publicUrl,
      file_name:  file.name,
      file_type:  file.type,
      quoted_id:  payload.quotedId ?? null,
      retracted:  false,
      reactions:  {},
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to send file: ${extractMessage(error)}`);
  return normalizeMessage(data);
}

// ─────────────────────────────────────────
// SEND VOICE MESSAGE
// ─────────────────────────────────────────
export async function uploadAndSendVoice(payload: {
  channelId:    string;
  userId:       string;
  userName:     string;
  tenantId:     string;
  blob:         Blob;
  durationSecs: number;
}): Promise<Message> {
  const path = `voice/${payload.channelId}/${crypto.randomUUID()}.webm`;

  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(path, payload.blob, { contentType: "audio/webm" });

  if (uploadError) {
    throw new Error(`Voice upload failed: ${extractMessage(uploadError)}`);
  }

  const { data: urlData } = supabase.storage
    .from("chat-media")
    .getPublicUrl(path);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id:    payload.channelId,
      user_id:       payload.userId,
      user_name:     payload.userName,
      tenant_id:     payload.tenantId,
      content:       "Voice message",
      type:          "voice",
      voice_url:     urlData.publicUrl,
      voice_seconds: Math.round(payload.durationSecs),
      retracted:     false,
      reactions:     {},
      created_at:    new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to send voice: ${extractMessage(error)}`);
  return normalizeMessage(data);
}

// ─────────────────────────────────────────
// RETRACT MESSAGE
// ─────────────────────────────────────────
export async function retractMessage(
  messageId: string,
  retractedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({
      retracted:    true,
      retracted_by: retractedBy,
      retracted_at: new Date().toISOString(),
      content:      "This message was retracted",
    })
    .eq("id", messageId);

  if (error) throw new Error(`Retract failed: ${extractMessage(error)}`);
}

// ─────────────────────────────────────────
// REACT TO MESSAGE
// ─────────────────────────────────────────
export async function toggleReaction(
  message:  Message,
  emoji:    string,
  userId:   string
): Promise<void> {
  const reactions = { ...message.reactions };

  if (!reactions[emoji]) reactions[emoji] = [];

  const idx = reactions[emoji].indexOf(userId);
  if (idx === -1) {
    reactions[emoji] = [...reactions[emoji], userId];
  } else {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  }

  const { error } = await supabase
    .from("messages")
    .update({ reactions })
    .eq("id", message.id);

  if (error) throw new Error(`Reaction failed: ${extractMessage(error)}`);
}

// ─────────────────────────────────────────
// REALTIME SUBSCRIPTION
// ─────────────────────────────────────────
export function subscribeToChannel(
  channelId: string,
  onInsert:  (msg: Message) => void,
  onUpdate:  (msg: Message) => void
) {
  const channel = supabase
    .channel(`chat-${channelId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => onInsert(normalizeMessage(payload.new))
    )
    .on(
      "postgres_changes",
      {
        event:  "UPDATE",
        schema: "public",
        table:  "messages",
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => onUpdate(normalizeMessage(payload.new))
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
// ─────────────────────────────────────────
// PINNING
// ─────────────────────────────────────────

/** Pin or unpin a message. Message pins are SHARED — visible to everyone in the channel. */
export async function togglePinMessage(
  message: Message,
  userId: string
): Promise<{ error: string | null }> {
  const next = !message.pinned;
  const { error } = await supabase
    .from("messages")
    .update({
      pinned:    next,
      pinned_at: next ? new Date().toISOString() : null,
      pinned_by: next ? userId : null,
    })
    .eq("id", message.id);
  return { error: error?.message ?? null };
}

/** All pinned messages in a channel, newest pin first. */
export async function getPinnedMessages(channelId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .eq("pinned", true)
    .eq("retracted", false)
    .order("pinned_at", { ascending: false });
  return (data ?? []) as Message[];
}

/** Channel ids this user has pinned. Channel pins are PER-USER. */
export async function getChannelPins(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("channel_pins")
    .select("channel_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: any) => r.channel_id as string);
}

export async function toggleChannelPin(
  channelId: string,
  userId: string,
  tenantId: string,
  currentlyPinned: boolean
): Promise<{ error: string | null }> {
  if (currentlyPinned) {
    const { error } = await supabase
      .from("channel_pins")
      .delete()
      .eq("user_id", userId)
      .eq("channel_id", channelId);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("channel_pins")
    .insert({ user_id: userId, channel_id: channelId, tenant_id: tenantId });
  return { error: error?.message ?? null };
}

/** Delete a channel and its messages. Admin/manager only — enforce at the call site. */
export async function deleteChannel(channelId: string): Promise<{ error: string | null }> {
  await supabase.from("messages").delete().eq("channel_id", channelId);
  const { error } = await supabase.from("channels").delete().eq("id", channelId);
  return { error: error?.message ?? null };
}