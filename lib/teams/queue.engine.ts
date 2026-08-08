import { supabase } from "../supabase";
import {
  getRoutingAction, shouldQueue, mapToQueueCategory,
  type UserStatus, type EventPriority, type QueueCategory,
} from "./status.engine";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export interface QueueItem {
  id:          string;
  tenant_id:   string;
  user_id:     string;
  source_type: "message" | "mention" | "alert" | "task";
  source_id:   string | null;
  category:    QueueCategory;
  priority:    EventPriority;
  status:      "pending" | "viewed" | "resolved";
  title:       string;
  summary:     string | null;
  created_at:  string;
}

export interface IncomingEvent {
  tenantId:    string;
  userId:      string;
  sourceType:  "message" | "mention" | "alert" | "task";
  sourceId?:   string | null;
  priority:    EventPriority;
  title:       string;
  summary?:    string | null;
  override?:   boolean;
}

// ─────────────────────────────────────────
// PROCESS EVENT THROUGH STATUS ENGINE
// Central routing function — call this for
// every event that targets a user.
// ─────────────────────────────────────────
export async function processEvent(
  event:      IncomingEvent,
  userStatus: UserStatus
): Promise<{ action: string; queued: boolean }> {
  const action = getRoutingAction(userStatus, event.priority);
  let queued   = false;

  switch (action) {
    case "notify":
      // Real-time delivery — no queue needed
      break;

    case "interrupt":
      // Push notification — critical break-through
      await createQueueItem(event); // still log it
      queued = true;
      break;

    case "silent_notify":
      // Badge only — push to queue
      await createQueueItem(event);
      queued = true;
      break;

    case "queue":
      // Deferred — push to queue only
      await createQueueItem(event);
      queued = true;
      break;

    case "conditional_interrupt":
      if (event.override) {
        // Allow through
      } else {
        await createQueueItem(event);
        queued = true;
      }
      break;

    case "block":
      // Discard — DND low priority
      break;
  }

  return { action, queued };
}

// ─────────────────────────────────────────
// CREATE QUEUE ITEM
// ─────────────────────────────────────────
export async function createQueueItem(event: IncomingEvent): Promise<QueueItem | null> {
  const category = mapToQueueCategory(event.sourceType, event.priority);

  const { data, error } = await supabase
    .from("queue_items")
    .insert({
      tenant_id:   event.tenantId,
      user_id:     event.userId,
      source_type: event.sourceType,
      source_id:   event.sourceId ?? null,
      category,
      priority:    event.priority,
      status:      "pending",
      title:       event.title,
      summary:     event.summary ?? null,
      created_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[Queue] createQueueItem failed:", error.message ?? error);
    return null;
  }

  return data as QueueItem;
}

// ─────────────────────────────────────────
// GET QUEUE FOR USER
// ─────────────────────────────────────────
export async function getUserQueue(
  userId:   string,
  tenantId: string,
  limit = 50
): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from("queue_items")
    .select("*")
    .eq("user_id",   userId)
    .eq("tenant_id", tenantId)
    .neq("status",   "resolved")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Queue] getUserQueue failed:", error.message ?? error);
    return [];
  }

  // Sort by priority weight
  const weight: Record<EventPriority, number> = {
    critical: 4, high: 3, normal: 2, low: 1,
  };

  return (data as QueueItem[]).sort(
    (a, b) => (weight[b.priority] ?? 0) - (weight[a.priority] ?? 0)
  );
}

// ─────────────────────────────────────────
// GET QUEUE GROUPED BY CATEGORY
// ─────────────────────────────────────────
export async function getGroupedQueue(
  userId:   string,
  tenantId: string
): Promise<Record<QueueCategory, QueueItem[]>> {
  const items = await getUserQueue(userId, tenantId);

  const grouped: Record<QueueCategory, QueueItem[]> = {
    escalations:   [],
    mentions:      [],
    approvals:     [],
    alerts:        [],
    conversations: [],
  };

  for (const item of items) {
    grouped[item.category].push(item);
  }

  return grouped;
}

// ─────────────────────────────────────────
// MARK ITEM VIEWED
// ─────────────────────────────────────────
export async function markQueueItemViewed(id: string): Promise<void> {
  await supabase
    .from("queue_items")
    .update({ status: "viewed" })
    .eq("id", id)
    .eq("status", "pending");
}

// ─────────────────────────────────────────
// RESOLVE QUEUE ITEM
// ─────────────────────────────────────────
export async function resolveQueueItem(id: string): Promise<void> {
  await supabase
    .from("queue_items")
    .update({ status: "resolved" })
    .eq("id", id);
}

// ─────────────────────────────────────────
// RESOLVE ALL IN CATEGORY
// ─────────────────────────────────────────
export async function resolveCategory(
  userId:   string,
  tenantId: string,
  category: QueueCategory
): Promise<void> {
  await supabase
    .from("queue_items")
    .update({ status: "resolved" })
    .eq("user_id",   userId)
    .eq("tenant_id", tenantId)
    .eq("category",  category)
    .neq("status",   "resolved");
}

// ─────────────────────────────────────────
// GET PENDING COUNT
// ─────────────────────────────────────────
export async function getQueueCount(
  userId:   string,
  tenantId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("queue_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id",   userId)
    .eq("tenant_id", tenantId)
    .eq("status",    "pending");

  if (error) return 0;
  return count ?? 0;
}

// ─────────────────────────────────────────
// SUBSCRIBE TO QUEUE UPDATES
// ─────────────────────────────────────────
export function subscribeToQueue(
  userId:   string,
  tenantId: string,
  onNew:    (item: QueueItem) => void
) {
  const channel = supabase
    .channel(`queue-${userId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "queue_items",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNew(payload.new as QueueItem)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}