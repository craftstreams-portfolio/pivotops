import { supabase } from "../supabase";

// ===============================
// EVENT TYPES
// ===============================
export type EventType =
  // =========================
  // RECRUITMENT
  // =========================
  | "CANDIDATE_CREATED"
  | "CANDIDATE_STATUS_CHANGED"
  | "CANDIDATE_MOVED_STAGE"
  | "CANDIDATE_UPDATED"

  // =========================
  // TASKS
  // =========================
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_PAUSED"
  | "TASK_RESUMED"
  | "TASK_COMPLETED"

  // =========================
  // SETTINGS
  // =========================
  | "SETTINGS_UPDATED"

  // =========================
  // CLOCKING
  // =========================
  | "USER_CLOCKED_IN"
  | "USER_CLOCKED_OUT"

  // =========================
  // SHOWCASE
  // =========================
  | "SHOWCASE_CREATED"

  // =========================
  // SPOTLIGHT
  // =========================
  | "USER_SPOTLIGHTED"

  // =========================
  // ADMIN
  // =========================
  | "USER_ROLE_UPDATED"

  // =========================
  // MENTIONS (NEW)
  // =========================
  | "MENTION_CREATED"
  | "MENTION_RESOLVED"
  | "MENTION_ESCALATED";

// ===============================
// EVENT PAYLOAD
// ===============================
export type EventPayload = {
  candidate_id?: string;

  task_id?: string;

  tenant_id?: string;

  status?: string;

  event_id?: string;

  timestamp?: string;

  // =========================
  // LOOP PROTECTION
  // =========================
  _internal?: boolean;

  [key: string]: any;
};

// ===============================
// EVENT CONTRACT
// ===============================
export type EventInput = {
  type: EventType;

  payload: EventPayload;
};

// ===============================
// IDEMPOTENCY KEY
// ===============================
function buildIdempotencyKey(
  event: EventInput
): string {
  const payload = event.payload;

  return (
    payload.event_id ||
    `${event.type}|${
      payload.candidate_id ||
      payload.task_id ||
      "none"
    }|${payload.status || "none"}|${
      payload.tenant_id || "default"
    }`
  );
}

// ===============================
// EMIT EVENT
// ===============================
export async function emitEvent(
  event: EventInput
) {
  // ===============================
  // HARD VALIDATION
  // ===============================
  if (
    !event?.type ||
    !event?.payload
  ) {
    console.error(
      "❌ Invalid event blocked:",
      event
    );

    return null;
  }

  // ===============================
  // INTERNAL LOOP PROTECTION
  // ===============================
  if (
    event.payload?._internal === true
  ) {
    console.warn(
      "⚠️ Internal recursive event blocked:",
      event.type
    );

    return null;
  }

  const idempotencyKey =
    buildIdempotencyKey(event);

  // ===============================
  // SAFE PAYLOAD
  // ===============================
  const payload: EventPayload = {
    ...event.payload,

    event_id: idempotencyKey,

    timestamp:
      event.payload?.timestamp ??
      new Date().toISOString(),
  };

  // ===============================
  // DUPLICATE CHECK
  // ===============================
  const {
    data: existing,
    error: duplicateError,
  } = await supabase
    .from("event_logs")
    .select("id")
    .eq(
      "idempotency_key",
      idempotencyKey
    )
    .maybeSingle();

  if (duplicateError) {
    console.error(
      "❌ Duplicate check failed:",
      {
        message:
          duplicateError.message,

        code: duplicateError.code,

        details:
          duplicateError.details,
      }
    );

    return null;
  }

  // ===============================
  // DUPLICATE BLOCK
  // ===============================
  if (existing?.id) {
    console.warn(
      "🔁 Duplicate event blocked:",
      idempotencyKey
    );

    return {
      skipped: true,
      idempotencyKey,
    };
  }

  // ===============================
  // EVENT ROW
  // ===============================
  const eventRow = {
    type: event.type,

    payload,

    status: "queued",

    idempotency_key:
      idempotencyKey,

    created_at:
      new Date().toISOString(),
  };

  // ===============================
  // INSERT EVENT
  // ===============================
  const { data, error } =
    await supabase
      .from("event_logs")
      .insert(eventRow)
      .select()
      .single();

  if (error) {
    console.error(
      "❌ Event emit failed:",
      {
        message: error.message,

        code: error.code,

        details: error.details,

        hint: error.hint,
      }
    );

    return {
      success: false,
      error,
    };
  }

  // ===============================
  // SUCCESS LOG
  // ===============================
  console.log(
    "📡 EVENT EMITTED:",
    {
      id: data?.id,

      type: event.type,

      key: idempotencyKey,
    }
  );

  return {
    success: true,

    id: data?.id,

    idempotencyKey,
  };
}