export type EventType =
  // ─── Recruitment ──────────────────────────
  | "CANDIDATE_CREATED"
  | "CANDIDATE_STATUS_CHANGED"
  | "CANDIDATE_MOVED_STAGE"
  | "CANDIDATE_UPDATED"

  // ─── Tasks ────────────────────────────────
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_PAUSED"
  | "TASK_RESUMED"
  | "TASK_COMPLETED"

  // ─── Clocking ─────────────────────────────
  | "USER_CLOCKED_IN"
  | "USER_CLOCKED_OUT"

  // ─── Settings ─────────────────────────────
  | "SETTINGS_UPDATED"

  // ─── Showcase / Spotlight ─────────────────
  | "SHOWCASE_CREATED"
  | "USER_SPOTLIGHTED"

  // ─── Admin ────────────────────────────────
  | "USER_ROLE_UPDATED"

  // ─── Mentions (NEW) ───────────────────────
  | "MENTION_CREATED"
  | "MENTION_RESOLVED"
  | "MENTION_ESCALATED";

// ─────────────────────────────────────────────
// MENTION EVENT PAYLOADS
// ─────────────────────────────────────────────
export type MentionType    = "user" | "department" | "all";
export type MentionContext = "task" | "comment" | "chat";

export interface MentionCreatedPayload {
  mentionId:   string;
  mentionType: MentionType;
  refId?:      string;
  refName?:    string;
  taskId?:     string;
  context:     MentionContext;
  content?:    string;
  createdBy:   string;
  tenantId:    string;
  createdAt:   string;
}

export interface MentionResolvedPayload {
  mentionId:  string;
  resolvedBy: string;
  tenantId:   string;
}

export interface MentionEscalatedPayload {
  mentionId:  string;
  taskId?:    string;
  reason:     string;
  tenantId:   string;
}

// ─────────────────────────────────────────────
// BASE EVENT
// ─────────────────────────────────────────────
export interface BaseEvent<T = any> {
  id?:        string;
  type:       EventType;
  payload:    T;
  created_at?: string;
}