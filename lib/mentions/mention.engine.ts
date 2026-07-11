import { supabase }    from "../supabase";
import { emitEvent }   from "../events/event-bus";
import type { MentionType, MentionContext } from "../events/event-types";
import { getAdmin } from "@/lib/supabase-admin";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export interface ParsedMention {
  raw:         string;   // e.g. "@john"
  type:        MentionType;
  refName:     string;   // resolved display name
  refId?:      string;   // user id or department id
}

export interface MentionRecord {
  id:           string;
  tenant_id:    string;
  mention_type: MentionType;
  ref_id:       string | null;
  ref_name:     string | null;
  task_id:      string | null;
  context:      MentionContext;
  content:      string | null;
  created_by:   string;
  created_at:   string;
  resolved:     boolean;
  escalated:    boolean;
}

// ─────────────────────────────────────────
// KNOWN DEPARTMENTS (matches your profiles.department)
// ─────────────────────────────────────────
const DEPARTMENT_KEYWORDS = [
  "engineering", "product", "design", "marketing", "sales",
  "hr", "finance", "operations", "legal", "customer success",
  "recruitment", "compliance",
];

// ─────────────────────────────────────────
// PARSE MENTIONS FROM TEXT
// e.g. "@john please review" → [{ type:"user", refName:"john" }]
// "@all urgent" → [{ type:"all", refName:"all" }]
// "@engineering blocked" → [{ type:"department", refName:"engineering" }]
// ─────────────────────────────────────────
export function extractMentions(
  content:  string,
  profiles: { id: string; full_name: string | null; email: string | null }[]
): ParsedMention[] {
  const regex   = /@(\w[\w\s]*?)(?=\s|$|[^a-zA-Z0-9_\s])/g;
  const matches = [...content.matchAll(regex)];
  const results: ParsedMention[] = [];

  for (const match of matches) {
    const raw  = match[0];
    const name = match[1].trim().toLowerCase();

    // @all — escalation signal
    if (name === "all" || name === "everyone" || name === "team") {
      results.push({ raw, type: "all", refName: "all" });
      continue;
    }

    // @department
    const dept = DEPARTMENT_KEYWORDS.find((d) => d === name || d.startsWith(name));
    if (dept) {
      results.push({ raw, type: "department", refName: dept });
      continue;
    }

    // @user — match against profiles by first name, full name, or email prefix
    const profile = profiles.find((p) => {
      const fn = (p.full_name ?? "").toLowerCase();
      const em = (p.email ?? "").split("@")[0].toLowerCase();
      return fn === name || fn.startsWith(name) || em === name;
    });

    results.push({
      raw,
      type:    "user",
      refName: profile?.full_name ?? match[1].trim(),
      refId:   profile?.id,
    });
  }

  return results;
}

// ─────────────────────────────────────────
// PROCESS MENTIONS — save + emit events
// Called when a task/comment/chat is created or updated
// ─────────────────────────────────────────
export async function processMentions({
  content,
  context,
  taskId,
  createdBy,
  tenantId,
  profiles,
}: {
  content:   string;
  context:   MentionContext;
  taskId?:   string;
  createdBy: string;
  tenantId:  string;
  profiles:  { id: string; full_name: string | null; email: string | null }[];
}): Promise<MentionRecord[]> {
  const parsed = extractMentions(content, profiles);
  if (parsed.length === 0) return [];

  const saved: MentionRecord[] = [];

  for (const mention of parsed) {
    const mentionId = crypto.randomUUID();
    const now       = new Date().toISOString();

    // 1. Save to mentions table
    const { data, error } = await supabase
      .from("mentions")
      .insert({
        id:           mentionId,
        tenant_id:    tenantId,
        mention_type: mention.type,
        ref_id:       mention.refId   ?? null,
        ref_name:     mention.refName ?? null,
        task_id:      taskId          ?? null,
        context,
        content,
        created_by:   createdBy,
        created_at:   now,
        resolved:     false,
        escalated:    mention.type === "all",
      })
      .select()
      .single();

    if (error) {
      console.error("Mention save failed:", error.message ?? error);
      continue;
    }

    saved.push(data as MentionRecord);

    // 2. Emit MENTION_CREATED event into the workforce bus
    await emitEvent({
      type: "MENTION_CREATED",
      payload: {
        mentionId,
        mentionType: mention.type,
        refId:       mention.refId,
        refName:     mention.refName,
        taskId:      taskId ?? null,
        context,
        content,
        createdBy,
        tenantId,
        timestamp:   now,
      },
    });

    // 3. Update task attention if task-linked
    if (taskId) {
      await updateTaskAttention(taskId, mention.type, mention.refId);
    }

    // 4. Create in-app notification
    if (mention.type === "user" && mention.refId) {
      await createNotification({
        tenantId,
        userId:    mention.refId,
        mentionId,
        taskId:    taskId ?? null,
        message:   `You were mentioned in a ${context} by ${createdBy}: "${content.slice(0, 80)}${content.length > 80 ? "..." : ""}"`,
      });
    }

    // 5. @all — Xavier AI escalation notification to all active users
    if (mention.type === "all") {
      await xavierEscalationBroadcast({
        tenantId,
        mentionId,
        taskId:    taskId ?? null,
        content,
        createdBy,
      });

      // Emit escalation event
      await emitEvent({
        type: "MENTION_ESCALATED",
        payload: {
          mentionId,
          taskId:    taskId ?? null,
          reason:    content,
          tenantId,
          timestamp: now,
        },
      });
    }
  }

  return saved;
}

// ─────────────────────────────────────────
// UPDATE TASK ATTENTION
// ─────────────────────────────────────────
async function updateTaskAttention(
  taskId:      string,
  mentionType: MentionType,
  refId?:      string
) {
  const { data: task } = await supabase
    .from("tasks")
    .select("attention, mention_count, due_date")
    .eq("id", taskId)
    .single();

  if (!task) return;

  const attention = task.attention ?? { users: [], departments: [], escalated: false };
  const count     = (task.mention_count ?? 0) + 1;

  if (mentionType === "user" && refId && !attention.users.includes(refId)) {
    attention.users.push(refId);
  }

  if (mentionType === "department" && refId && !attention.departments.includes(refId)) {
    attention.departments.push(refId);
  }

  if (mentionType === "all") {
    attention.escalated = true;
  }

  // Recalculate risk level
  const dueDate   = task.due_date ? new Date(task.due_date) : null;
  const now       = new Date();
  const hoursLeft = dueDate ? (dueDate.getTime() - now.getTime()) / 36e5 : null;

  const riskLevel =
    attention.escalated            ? "critical" :
    count >= 3                     ? "high"     :
    hoursLeft !== null && hoursLeft < 24 ? "high" :
    hoursLeft !== null && hoursLeft < 72 ? "medium" : "normal";

  await supabase
    .from("tasks")
    .update({
      attention,
      mention_count: count,
      risk_level:    riskLevel,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", taskId);
}

// ─────────────────────────────────────────
// CREATE IN-APP NOTIFICATION
// ─────────────────────────────────────────
async function createNotification({
  tenantId, userId, mentionId, taskId, message,
}: {
  tenantId:  string;
  userId:    string;
  mentionId: string;
  taskId:    string | null;
  message:   string;
}) {
  await supabase.from("notifications").insert({
    tenant_id:  tenantId,
    user_id:    userId,
    mention_id: mentionId,
    task_id:    taskId,
    type:       "mention",
    message,
    read:       false,
    created_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────
// XAVIER AI ESCALATION BROADCAST
// Notifies all active users + saves Xavier notification
// ─────────────────────────────────────────
async function xavierEscalationBroadcast({
  tenantId, mentionId, taskId, content, createdBy,
}: {
  tenantId:  string;
  mentionId: string;
  taskId:    string | null;
  content:   string;
  createdBy: string;
}) {
  const message =
    `🚨 Xavier AI · @all escalation by ${createdBy}: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}"` +
    (taskId ? ` [Task linked]` : "");

  // Save Xavier notification
  await supabase.from("xavier_notifications").insert({
    tenant_id:    tenantId,
    candidate_id: null,
    stage:        "auto_reject",   // reuse alert type
    message,
    type:         "alert",
    read:         false,
    created_at:   new Date().toISOString(),
  });

  // Post to recruitment-review channel as system message
  await getAdmin().from("messages").insert({
    channel_id:  "1da7f9fa-7f21-4557-bc59-7b0cb2a53b63",
    content:     message,
    user_id:     "00000000-0000-0000-0000-000000000000",
    user_name:   "Xavier AI",
    tenant_id:   tenantId,
    type:        "system",
    retracted:   false,
    reactions:   {},
    created_at:  new Date().toISOString(),
  });
}

// ─────────────────────────────────────────
// XAVIER AUTO-ESCALATION (called by cron or worker)
// Checks for overdue tasks with no recent activity
// ─────────────────────────────────────────
export async function xavierAutoEscalate(tenantId: string) {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: staleTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("done", false)
    .lt("updated_at", threshold)
    .not("status", "eq", "completed");

  if (!staleTasks || staleTasks.length === 0) return;

  for (const task of staleTasks) {
    const dueDate   = task.due_date ? new Date(task.due_date) : null;
    const isOverdue = dueDate && dueDate < new Date();

    if (!isOverdue && (task.mention_count ?? 0) > 0) continue;

    const mentionId = crypto.randomUUID();
    const message   =
      `🤖 Xavier AI · Auto-escalation: Task "${task.title}" ` +
      (isOverdue ? `is OVERDUE` : `has had no activity for 24h`) +
      `. Routing to manager attention.`;

    await supabase.from("mentions").insert({
      id:           mentionId,
      tenant_id:    tenantId,
      mention_type: "all",
      ref_id:       null,
      ref_name:     "Xavier AI",
      task_id:      task.id,
      context:      "task",
      content:      message,
      created_by:   "xavier-ai",
      created_at:   new Date().toISOString(),
      resolved:     false,
      escalated:    true,
    });

    await emitEvent({
      type: "MENTION_ESCALATED",
      payload: {
        mentionId,
        taskId:    task.id,
        reason:    isOverdue ? "Task overdue" : "No activity for 24h",
        tenantId,
        timestamp: new Date().toISOString(),
      },
    });

    // Update task risk
    await supabase
      .from("tasks")
      .update({
        risk_level: isOverdue ? "critical" : "high",
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
  }
}

// ─────────────────────────────────────────
// RESOLVE MENTION
// ─────────────────────────────────────────
export async function resolveMention(
  mentionId:  string,
  resolvedBy: string
) {
  const resolvedAt = new Date().toISOString();

  // Fetch the mention so we can compute response time + tenant.
  const { data: mention } = await getAdmin()
    .from("mentions")
    .select("created_at, tenant_id")
    .eq("id", mentionId)
    .single();

  await supabase
    .from("mentions")
    .update({ resolved: true, resolved_at: resolvedAt })
    .eq("id", mentionId);

  // Response-time tracking: log how long from mention -> resolution.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedBy ?? "");
  if (mention?.created_at && mention?.tenant_id && isUuid) {
    const mins = Math.max(0, Math.round((new Date(resolvedAt).getTime() - new Date(mention.created_at).getTime()) / 60000));
    await getAdmin().from("response_events").insert({
      tenant_id:        mention.tenant_id,
      user_id:          resolvedBy,
      kind:             "message",
      opened_at:        mention.created_at,
      responded_at:     resolvedAt,
      response_minutes: mins,
      ref_id:           mentionId,
    });
  }

  await emitEvent({
    type: "MENTION_RESOLVED",
    payload: {
      mentionId,
      resolvedBy,
      timestamp: new Date().toISOString(),
    },
  });
}

// ─────────────────────────────────────────
// GET MENTIONS ANALYTICS
// ─────────────────────────────────────────
export async function getMentionAnalytics(tenantId: string) {
  const { data: mentions } = await supabase
    .from("mentions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (!mentions) return null;

  const total       = mentions.length;
  const resolved    = mentions.filter((m) => m.resolved).length;
  const escalated   = mentions.filter((m) => m.escalated).length;
  const byType      = {
    user:       mentions.filter((m) => m.mention_type === "user").length,
    department: mentions.filter((m) => m.mention_type === "department").length,
    all:        mentions.filter((m) => m.mention_type === "all").length,
  };

  // Avg response time
  const resolved_with_time = mentions.filter(
    (m) => m.resolved && m.resolved_at
  );
  const avgResponseMs =
    resolved_with_time.length > 0
      ? resolved_with_time.reduce((sum, m) => {
          return sum + (new Date(m.resolved_at).getTime() - new Date(m.created_at).getTime());
        }, 0) / resolved_with_time.length
      : null;

  const avgResponseHours = avgResponseMs ? avgResponseMs / 36e5 : null;

  return {
    total,
    resolved,
    escalated,
    unresolved: total - resolved,
    byType,
    avgResponseHours: avgResponseHours ? Math.round(avgResponseHours * 10) / 10 : null,
    insight:
      escalated > total * 0.3
        ? "High escalation rate — consider workload rebalancing"
        : avgResponseHours && avgResponseHours > 4
          ? "Slow mention response — attention may be bottlenecked"
          : "Mention patterns are healthy",
  };
}

// ─────────────────────────────────────────
// GET USER NOTIFICATIONS
// ─────────────────────────────────────────
export async function getUserNotifications(
  userId:   string,
  tenantId: string,
  limit = 30
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch notifications:", error.message ?? error);
    return [];
  }

  return data ?? [];
}

// ─────────────────────────────────────────
// MARK NOTIFICATIONS READ
// ─────────────────────────────────────────
export async function markUserNotificationsRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}