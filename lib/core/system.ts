import { supabase } from "../supabase";

// ===============================
// DEFAULT SETTINGS
// ===============================
export const defaultSettings = {
  ai_enabled: true,
  auto_move_candidates: true,
  auto_reject_enabled: false,
  chat_realtime_enabled: true,
  analytics_refresh_rate: 30,
};

// ===============================
// GET SETTINGS
// ===============================
export async function getSettings(tenant_id: string) {
  if (!tenant_id) return defaultSettings;

  const { data } = await supabase
    .from("system_settings")
    .select("*")
    .eq("tenant_id", tenant_id)
    .single();

  return data || defaultSettings;
}

// ===============================
// UPDATE SETTINGS
// ===============================
export async function updateSettings(
  tenant_id: string,
  updates: Partial<typeof defaultSettings>
) {
  if (!tenant_id) return;

  const { error } = await supabase.from("system_settings").upsert({
    tenant_id,
    ...updates,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Settings update failed:", error);
  }
}

// ===============================
// CHECK IF FEATURE ENABLED
// ===============================
export function isEnabled(settings: any, key: keyof typeof defaultSettings) {
  return settings?.[key] ?? defaultSettings[key];
}

// ======================================================
// EVENT BUS (SYSTEM-WIDE COMMUNICATION LAYER)
// ======================================================

// ===============================
// EMIT EVENT
// ===============================
export async function emitEvent(event: {
  type: string;
  payload: any;
}) {
  if (!event?.type) return;

  const { error } = await supabase.from("event_logs").insert({
    type: event.type,
    payload: event.payload,
    status: "pending",
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Event emit failed:", error);
  }
}

// ===============================
// CANDIDATE EVENT EMITTER
// ===============================
export async function emitCandidateEvent(
  candidate_id: string,
  status: string,
  tenant_id: string
) {
  await emitEvent({
    type: "CANDIDATE_STATUS_CHANGED",
    payload: {
      candidate_id,
      status,
      tenant_id,
      timestamp: new Date().toISOString(),
    },
  });
}

// ======================================================
// CHAT SYNC BRIDGE (EVENT → CHAT)
// ======================================================

// ===============================
// PROCESS EVENT INTO CHAT MESSAGE
// ===============================
export async function processChatEvent(event: any) {
  if (!event?.type) return;

  try {
    if (event.type === "CANDIDATE_STATUS_CHANGED") {
      const { candidate_id, status } = event.payload;

      await supabase.from("messages").insert({
        candidate_id,
        content: `📌 Candidate moved to: ${status}`,
        user_name: "System",
        type: "system",
      });
    }

    if (event.type === "TASK_UPDATED") {
      const { task_id, status } = event.payload;

      await supabase.from("messages").insert({
        task_id,
        content: `📌 Task updated: ${status}`,
        user_name: "System",
        type: "system",
      });
    }
  } catch (err) {
    console.error("Chat event processing failed:", err);
  }
}

// ===============================
// REALTIME EVENT LISTENER (CHAT SYNC)
// ===============================
export function startEventListener() {
  return supabase
    .channel("event-log-stream")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "event_logs",
      },
      async (payload) => {
        await processChatEvent(payload.new);
      }
    )
    .subscribe();
}