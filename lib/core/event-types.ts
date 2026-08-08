export type EventType =
  | "CANDIDATE_CREATED"
  | "CANDIDATE_STATUS_CHANGED"
  | "CANDIDATE_MOVED_STAGE"
  | "TASK_CREATED"
  | "TASK_UPDATED";

export interface BaseEvent<T = any> {
  id?: string;
  type: EventType;
  payload: T;
  created_at?: string;
  idempotency_key?: string;
}