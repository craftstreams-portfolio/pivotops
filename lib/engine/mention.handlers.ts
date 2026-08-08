import { supabase }        from "../supabase";
import { updateEventStatus } from "../events/event-store";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface MentionCreatedPayload {
  mentionId:   string;
  mentionType: "user" | "department" | "all";
  refId?:      string;
  refName?:    string;
  taskId?:     string;
  context:     string;
  content?:    string;
  createdBy:   string;
  tenantId:    string;
  timestamp:   string;
}

interface MentionResolvedPayload {
  mentionId:  string;
  resolvedBy: string;
  tenantId?:  string;
  timestamp:  string;
}

interface MentionEscalatedPayload {
  mentionId: string;
  taskId?:   string;
  reason:    string;
  tenantId:  string;
  timestamp: string;
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// MAIN ENTRY POINT
// Called by workforce.engine.ts router
// ─────────────────────────────────────────
export async function handleMentionEvent(event: any) {
  const { type, payload } = event;

  try {
    switch (type) {
      case "MENTION_CREATED":
        return await handleMentionCreated(payload as MentionCreatedPayload);

      case "MENTION_RESOLVED":
        return await handleMentionResolved(payload as MentionResolvedPayload);

      case "MENTION_ESCALATED":
        return await handleMentionEscalated(payload as MentionEscalatedPayload);

      default:
        console.warn("Unhandled mention event:", type);
        return null;
    }
  } catch (err) {
    console.error(`Mention handler failed [${type}]:`, extractMessage(err));
    throw err;
  }
}

// ─────────────────────────────────────────
// 1. MENTION CREATED
// ─────────────────────────────────────────
async function handleMentionCreated(payload: MentionCreatedPayload) {
  const { mentionId, mentionType, refId, refName, taskId, context, content, createdBy, tenantId } = payload;

  // ── A. Route notification based on mention type ──
  if (mentionType === "user" && refId) {
    // Direct user notification already created in mention.engine.ts
    // Here we log the routing decision
    console.log(`[MENTION] @${refName ?? refId} notified in context: ${context}`);
  }

  if (mentionType === "department" && refName) {
    // Broadcast to all active users in the department
    const { data: deptUsers } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .ilike("department", refName);

    if (deptUsers && deptUsers.length > 0) {
      const notifications = deptUsers.map((u) => ({
        tenant_id:  tenantId,
        user_id:    u.id,
        mention_id: mentionId,
        task_id:    taskId ?? null,
        type:       "mention",
        message:    `@${refName} (your department) was mentioned by ${createdBy}: "${(content ?? "").slice(0, 80)}"`,
        read:       false,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) console.error("Dept notification insert failed:", extractMessage(error));

      console.log(`[MENTION] @${refName} department broadcast to ${deptUsers.length} users`);
    }
  }

  if (mentionType === "all") {
    // @all — log escalation, notification already sent by mention.engine.ts
    console.log(`[MENTION] @all escalation triggered by ${createdBy} in ${context}`);

    // If task-linked, bump priority to high
    if (taskId) {
      await supabase
        .from("tasks")
        .update({
          risk_level: "critical",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }
  }

  // ── B. Log to event_logs for analytics ──
  await supabase.from("event_logs").insert({
    type:             "MENTION_PROCESSED",
    payload:          payload,
    status:           "processed",
    idempotency_key:  `mention-processed-${mentionId}`,
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }).select().maybeSingle(); // ignore duplicate errors

  return { processed: true, mentionId, mentionType };
}

// ─────────────────────────────────────────
// 2. MENTION RESOLVED
// ─────────────────────────────────────────
async function handleMentionResolved(payload: MentionResolvedPayload) {
  const { mentionId, resolvedBy } = payload;

  // Fetch the mention to get task context
  const { data: mention } = await supabase
    .from("mentions")
    .select("*")
    .eq("id", mentionId)
    .single();

  if (!mention) {
    console.warn("Mention not found for resolution:", mentionId);
    return null;
  }

  // If task-linked, check if all mentions are resolved → lower risk
  if (mention.task_id) {
    const { data: remaining } = await supabase
      .from("mentions")
      .select("id")
      .eq("task_id", mention.task_id)
      .eq("resolved", false);

    if (!remaining || remaining.length === 0) {
      await supabase
        .from("tasks")
        .update({
          risk_level: "normal",
          updated_at: new Date().toISOString(),
        })
        .eq("id", mention.task_id);

      console.log(`[MENTION] All mentions resolved for task ${mention.task_id} — risk reset to normal`);
    }
  }

  console.log(`[MENTION] Resolved: ${mentionId} by ${resolvedBy}`);
  return { resolved: true, mentionId };
}

// ─────────────────────────────────────────
// 3. MENTION ESCALATED
// ─────────────────────────────────────────
async function handleMentionEscalated(payload: MentionEscalatedPayload) {
  const { mentionId, taskId, reason, tenantId } = payload;

  // Fetch all managers/admins in the tenant to notify
  const { data: managers } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "manager"]);

  if (managers && managers.length > 0) {
    const notifications = managers.map((m) => ({
      tenant_id:  tenantId,
      user_id:    m.id,
      mention_id: mentionId,
      task_id:    taskId ?? null,
      type:       "escalation",
      message:    `🚨 Escalation alert: ${reason}${taskId ? ` [Task ID: ${taskId}]` : ""}`,
      read:       false,
      created_at: new Date().toISOString(),
    }));

    await supabase.from("notifications").insert(notifications);
    console.log(`[MENTION] Escalation sent to ${managers.length} manager(s)`);
  }

  // Xavier AI suggestion: if task is linked, suggest assigning a manager
  if (taskId) {
    const manager = managers?.[0];
    if (manager) {
      await supabase.from("xavier_notifications").insert({
        tenant_id:    tenantId,
        candidate_id: null,
        stage:        "auto_reject",
        message:      `🤖 Xavier AI · Escalation detected on task. Suggesting ${manager.full_name ?? manager.email} for immediate attention. Reason: ${reason}`,
        type:         "alert",
        read:         false,
        created_at:   new Date().toISOString(),
      });
    }
  }

  return { escalated: true, mentionId, notifiedManagers: managers?.length ?? 0 };
}