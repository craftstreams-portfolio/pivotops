import { supabase } from "../supabase";
import type { ParsedMention } from "./mention.parser";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export interface Mention {
  id:           string;
  tenant_id:    string;
  mention_type: "user" | "department" | "all";
  ref_id:       string | null;
  ref_name:     string | null;
  task_id:      string | null;
  context:      "task" | "comment" | "chat";
  content:      string | null;
  created_by:   string;
  created_at:   string;
  resolved:     boolean;
  resolved_at:  string | null;
  resolved_by:  string | null;
}

export interface AppNotification {
  id:         string;
  tenant_id:  string;
  user_id:    string;
  type:       string;
  title:      string;
  body:       string | null;
  ref_id:     string | null;
  ref_type:   string | null;
  read:       boolean;
  created_at: string;
}

// ─────────────────────────────────────────
// SAVE MENTIONS TO DB
// ─────────────────────────────────────────
export async function saveMentions(payload: {
  tenantId:   string;
  createdBy:  string;
  mentions:   ParsedMention[];
  context:    "task" | "comment" | "chat";
  content:    string;
  taskId?:    string | null;
}): Promise<Mention[]> {
  if (!payload.mentions.length) return [];

  const rows = payload.mentions.map((m) => ({
    tenant_id:    payload.tenantId,
    mention_type: m.type,
    ref_id:       m.refId,
    ref_name:     m.refName,
    task_id:      payload.taskId ?? null,
    context:      payload.context,
    content:      payload.content,
    created_by:   payload.createdBy,
    resolved:     false,
  }));

  const { data, error } = await supabase
    .from("mentions")
    .insert(rows)
    .select();

  if (error) {
    console.error("[Mentions] save failed:", error.message ?? error);
    return [];
  }

  return data as Mention[];
}

// ─────────────────────────────────────────
// CREATE IN-APP NOTIFICATIONS FOR MENTIONS
// ─────────────────────────────────────────
export async function notifyMentionedUsers(payload: {
  tenantId:      string;
  createdBy:     string;
  createdByName: string;
  mentions:      ParsedMention[];
  context:       "task" | "comment" | "chat";
  content:       string;
  refId?:        string | null;
  profiles:      { id: string; full_name: string | null; email: string | null; department: string | null }[];
}): Promise<void> {
  const { tenantId, createdBy, createdByName, mentions, context, content, refId, profiles } = payload;

  const notifications: {
    tenant_id: string;
    user_id:   string;
    type:      string;
    title:     string;
    body:      string;
    ref_id:    string | null;
    ref_type:  string;
    read:      boolean;
  }[] = [];

  for (const mention of mentions) {
    if (mention.type === "user" && mention.refId) {
      // Direct user mention
      if (mention.refId === createdBy) continue; // don't notify yourself
      notifications.push({
        tenant_id: tenantId,
        user_id:   mention.refId,
        type:      "mention",
        title:     `${createdByName} mentioned you`,
        body:      content.slice(0, 120),
        ref_id:    refId ?? null,
        ref_type:  context,
        read:      false,
      });
    } else if (mention.type === "department" && mention.refId) {
      // Notify all users in that department
      const deptUsers = profiles.filter(
        (p) => p.department?.toLowerCase() === mention.refId?.toLowerCase() && p.id !== createdBy
      );
      for (const user of deptUsers) {
        notifications.push({
          tenant_id: tenantId,
          user_id:   user.id,
          type:      "mention_department",
          title:     `${createdByName} mentioned @${mention.refName}`,
          body:      content.slice(0, 120),
          ref_id:    refId ?? null,
          ref_type:  context,
          read:      false,
        });
      }
    } else if (mention.type === "all") {
      // Notify everyone in tenant except creator
      for (const user of profiles.filter((p) => p.id !== createdBy)) {
        notifications.push({
          tenant_id: tenantId,
          user_id:   user.id,
          type:      "mention_all",
          title:     `${createdByName} mentioned @all`,
          body:      content.slice(0, 120),
          ref_id:    refId ?? null,
          ref_type:  context,
          read:      false,
        });
      }
    }
  }

  if (!notifications.length) return;

  // Deduplicate by user_id + ref_id
  const seen = new Set<string>();
  const deduped = notifications.filter((n) => {
    const key = `${n.user_id}:${n.ref_id}:${n.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { error } = await supabase.from("notifications").insert(deduped);
  if (error) {
    console.error("[Mentions] notification insert failed:", error.message ?? error);
  }
}

// ─────────────────────────────────────────
// GET NOTIFICATIONS FOR USER
// ─────────────────────────────────────────
export async function getUserNotifications(
  userId:   string,
  tenantId: string,
  limit = 30
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id",   userId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Notifications] fetch failed:", error.message ?? error);
    return [];
  }
  return data as AppNotification[];
}

// ─────────────────────────────────────────
// MARK NOTIFICATIONS READ
// ─────────────────────────────────────────
export async function markNotificationsRead(
  userId:   string,
  tenantId: string
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id",   userId)
    .eq("tenant_id", tenantId)
    .eq("read",      false);
}

// ─────────────────────────────────────────
// MARK SINGLE NOTIFICATION READ
// ─────────────────────────────────────────
export async function markOneRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

// ─────────────────────────────────────────
// RESOLVE MENTION
// ─────────────────────────────────────────
export async function resolveMention(
  mentionId:  string,
  resolvedBy: string
): Promise<void> {
  await supabase
    .from("mentions")
    .update({
      resolved:    true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq("id", mentionId);
}

// ─────────────────────────────────────────
// GET MENTIONS FOR TASK
// ─────────────────────────────────────────
export async function getTaskMentions(taskId: string): Promise<Mention[]> {
  const { data, error } = await supabase
    .from("mentions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Mentions] task fetch failed:", error.message ?? error);
    return [];
  }
  return data as Mention[];
}

// ─────────────────────────────────────────
// SUBSCRIBE TO USER NOTIFICATIONS
// ─────────────────────────────────────────
export function subscribeToNotifications(
  userId:   string,
  tenantId: string,
  onNew:    (n: AppNotification) => void
) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNew(payload.new as AppNotification)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}