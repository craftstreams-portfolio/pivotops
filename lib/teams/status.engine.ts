// ─────────────────────────────────────────
// STATUS ENGINE
// Defines behavioral routing rules for every
// combination of user status + event priority.
// ─────────────────────────────────────────

export type UserStatus =
  | "ONLINE"
  | "MEETING"
  | "OOO"
  | "VACATION"
  | "DND"
  | "OFFLINE";

export type EventPriority = "low" | "normal" | "high" | "critical";

export type RoutingAction =
  | "notify"               // deliver immediately in real time
  | "silent_notify"        // badge only, no interruption
  | "queue"                // defer to queue, no notification
  | "interrupt"            // push notification, break through
  | "conditional_interrupt"// push only if override flag is true
  | "block";               // discard entirely (DND low)

export interface StatusMeta {
  label:       string;
  color:       string;         // tailwind text color
  dot:         string;         // tailwind bg color for presence dot
  emoji:       string;
  description: string;
}

// ─────────────────────────────────────────
// STATUS DISPLAY METADATA
// ─────────────────────────────────────────
export const STATUS_META: Record<UserStatus, StatusMeta> = {
  ONLINE: {
    label:       "Online",
    color:       "text-emerald-400",
    dot:         "bg-emerald-400",
    emoji:       "🟢",
    description: "Full engagement — all notifications active",
  },
  MEETING: {
    label:       "In a Meeting",
    color:       "text-amber-400",
    dot:         "bg-amber-400",
    emoji:       "🟠",
    description: "Focus mode — only high priority breaks through",
  },
  OOO: {
    label:       "Out of Office",
    color:       "text-blue-400",
    dot:         "bg-blue-400",
    emoji:       "🔵",
    description: "Short absence — only critical alerts allowed",
  },
  VACATION: {
    label:       "Vacation",
    color:       "text-purple-400",
    dot:         "bg-purple-400",
    emoji:       "🟣",
    description: "Long absence — everything queued, critical only",
  },
  DND: {
    label:       "Do Not Disturb",
    color:       "text-red-400",
    dot:         "bg-red-400",
    emoji:       "🔴",
    description: "Intentional focus lock — critical with override only",
  },
  OFFLINE: {
    label:       "Offline",
    color:       "text-zinc-500",
    dot:         "bg-zinc-600",
    emoji:       "⚫",
    description: "Inactive — all events queued",
  },
};

// ─────────────────────────────────────────
// ROUTING RULES MATRIX
// status × priority → action
// ─────────────────────────────────────────
const ROUTING_MATRIX: Record<UserStatus, Record<EventPriority, RoutingAction>> = {
  ONLINE: {
    low:      "notify",
    normal:   "notify",
    high:     "notify",
    critical: "interrupt",
  },
  MEETING: {
    low:      "queue",
    normal:   "queue",
    high:     "silent_notify",
    critical: "interrupt",
  },
  OOO: {
    low:      "queue",
    normal:   "queue",
    high:     "queue",
    critical: "notify",
  },
  VACATION: {
    low:      "queue",
    normal:   "queue",
    high:     "queue",
    critical: "interrupt",
  },
  DND: {
    low:      "block",
    normal:   "queue",
    high:     "queue",
    critical: "conditional_interrupt",
  },
  OFFLINE: {
    low:      "queue",
    normal:   "queue",
    high:     "queue",
    critical: "queue",
  },
};

// ─────────────────────────────────────────
// MAIN ROUTING FUNCTION
// ─────────────────────────────────────────
export function getRoutingAction(
  status:   UserStatus,
  priority: EventPriority
): RoutingAction {
  return ROUTING_MATRIX[status]?.[priority] ?? "queue";
}

// ─────────────────────────────────────────
// SHOULD NOTIFY — simple boolean helper
// ─────────────────────────────────────────
export function shouldNotify(
  status:        UserStatus,
  priority:      EventPriority,
  overrideFlag?: boolean
): boolean {
  const action = getRoutingAction(status, priority);
  switch (action) {
    case "notify":
    case "interrupt":
      return true;
    case "silent_notify":
      return false; // badge only
    case "conditional_interrupt":
      return overrideFlag === true;
    case "queue":
    case "block":
    default:
      return false;
  }
}

// ─────────────────────────────────────────
// SHOULD QUEUE — should this go into queue_items?
// ─────────────────────────────────────────
export function shouldQueue(
  status:   UserStatus,
  priority: EventPriority
): boolean {
  const action = getRoutingAction(status, priority);
  return action === "queue" || action === "silent_notify" || action === "conditional_interrupt";
}

// ─────────────────────────────────────────
// QUEUE CATEGORY MAPPER
// Maps event types to queue UI sections
// ─────────────────────────────────────────
export type QueueCategory =
  | "mentions"
  | "approvals"
  | "conversations"
  | "alerts"
  | "escalations";

export function mapToQueueCategory(
  sourceType: string,
  priority:   EventPriority
): QueueCategory {
  if (priority === "critical")       return "escalations";
  if (sourceType === "mention")      return "mentions";
  if (sourceType === "alert")        return "alerts";
  if (sourceType === "task")         return "approvals";
  return "conversations";
}