// ===============================
// EVENT CORE SCHEMA (SINGLE SOURCE OF TRUTH)
// ===============================

export type EventStatus =
  | "success"
  | "failed"
  | "pending"
  | "ignored"
  | "processed"
  | "escalated"
  | "manual_review";

export type EventSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type EventCategory =
  | "worker"
  | "queue"
  | "database"
  | "timeout"
  | "unknown";

// ===============================
// OPTIONAL CAUSALITY FIELDS (PHASE 13G READY)
// ===============================
export type EventCausality = {
  correlationId?: string;
  parentEventId?: string;
};

// ===============================
// CANONICAL EVENT TRACE (HARDENED)
// ===============================
export type EventTrace = {
  eventId: string;

  stage: string;

  type: string;

  status: EventStatus;

  severity?: EventSeverity;

  category?: EventCategory;

  timestamp: number;

  payload: Record<string, unknown>;

  // ===============================
  // CAUSAL GRAPH SUPPORT (FOR PHASE 13G)
  // ===============================
  correlationId?: string;

  parentEventId?: string;
};