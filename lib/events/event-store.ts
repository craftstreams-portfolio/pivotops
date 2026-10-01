import { supabase } from "../supabase";

// ===============================
// EVENT TYPE (EXPANDED FOR AI RECOVERY SYSTEM)
// ===============================
export type EventStatus =
  | "queued"
  | "processing"
  | "processed"
  | "failed"
  | "ignored"
  | "pending"
  | "escalated"
  | "manual_review";

export type StoredEvent = {
  id?: string;
  type: string;
  payload: Record<string, any>;

  status: EventStatus;

  idempotency_key?: string;
  created_at?: string;
  updated_at?: string;
};

// ===============================
// SAVE EVENT (SOURCE OF TRUTH)
// ===============================
export async function saveEvent(event: StoredEvent) {
  if (!event?.type || !event?.payload) {
    console.error("❌ Invalid event blocked:", event);
    return null;
  }

  const idempotencyKey =
    event.idempotency_key ??
    `${event.type}|${
      event.payload?.candidate_id ??
      event.payload?.task_id ??
      "none"
    }|${event.payload?.updated_at ?? Date.now()}`;

  const row: StoredEvent = {
    type: event.type,
    payload: event.payload ?? {},
    status: event.status ?? "queued",
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: checkError } = await supabase
    .from("event_logs")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (checkError) {
    console.error("❌ Duplicate check failed:", checkError);
  }

  if (existing?.id) {
    return {
      skipped: true,
      idempotencyKey,
    };
  }

  const { data, error } = await supabase
    .from("event_logs")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("❌ EVENT STORE INSERT FAILED:", error);
    throw new Error("EVENT_INSERT_FAILED");
  }

  return data;
}

// ===============================
// UPDATE EVENT STATUS (AI-COMPATIBLE)
// ===============================
export async function updateEventStatus(
  id: string,
  status: EventStatus
) {
  if (!id) return;

  const { error } = await supabase
    .from("event_logs")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("❌ Failed updating event status:", error);
  }
}