import { supabase } from "../supabase";
import { handleChatEvent } from "../chat/chat-handler";
import { applyRealtimeUpdate } from "./ui-sync";
import { notify } from "../notify";

// ===============================
// REPLAY PROTECTION CACHE
// ===============================
const seenEvents = new Set<string>();

const MAX_CACHE_SIZE = 5000;

// prevents memory bloat in long sessions
function safeAdd(key: string) {
  if (seenEvents.size > MAX_CACHE_SIZE) {
    seenEvents.clear();
  }
  seenEvents.add(key);
}

// ===============================
// MAIN LISTENER
// ===============================
export function startRealtimeListener() {
  const channel = supabase.channel("pivotops-event-stream");

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "event_logs",
    },
    async (payload) => {
      try {
        const event = payload?.new;

        // ===============================
        // HARD GUARD
        // ===============================
        if (!event?.type || !event?.payload) return;

        const payloadData = event.payload;

        // ===============================
        // STABLE IDEMPOTENCY KEY
        // ===============================
        const replayKey = String(
          event.idempotency_key ??
          `${event.type}|${payloadData?.candidate_id ?? payloadData?.task_id ?? "none"}|${event.created_at ?? Date.now()}`
        );

        // ===============================
        // REPLAY GUARD
        // ===============================
        if (seenEvents.has(replayKey)) return;

        safeAdd(replayKey);

        const type = event.type;

        // IMPORTANT: ensure payload is always object
        const data = typeof payloadData === "object" && payloadData !== null
          ? payloadData
          : {};

        // ===============================
        // 1. UI SYNC LAYER (PURE STATE)
        // ===============================
        applyRealtimeUpdate({
          type,
          payload: data,
        });

        // ===============================
        // 2. CHAT PIPELINE
        // ===============================
        if (
          type === "CANDIDATE_STATUS_CHANGED" ||
          type === "CANDIDATE_UPDATED" ||
          type === "CANDIDATE_CREATED"
        ) {
          await handleChatEvent({
            type,
            payload: data,
          });
        }

        // ===============================
        // 3. NOTIFICATIONS
        // ===============================
        if (type === "CANDIDATE_STATUS_CHANGED") {
          notify(`📡 Candidate moved to ${data?.status || "unknown"}`);
        }

        if (type === "TASK_UPDATED") {
          notify(`🧩 Task updated: ${data?.status || "updated"}`);
        }

      } catch (err) {
        console.error("🔥 Realtime listener error:", err);
      }
    }
  );

  channel.subscribe((status) => {
    console.log("📡 Realtime status:", status);
  });

  return channel;
}