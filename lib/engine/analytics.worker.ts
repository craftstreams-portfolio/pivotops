import { processAnalyticsEvent } from "./analytics.handlers";
import { supabase } from "../supabase";

const WORKER_ID = crypto.randomUUID();

export async function runAnalyticsWorker() {
  // ===============================
  // FETCH PENDING ANALYTICS EVENTS
  // ===============================
  const { data: events } = await supabase
    .from("event_logs")
    .select("*")
    .eq("module", "analytics")
    .eq("status", "pending")
    .limit(50);

  if (!events || events.length === 0) return;

  for (const event of events) {
    try {
      await supabase
        .from("event_logs")
        .update({
          status: "processing",
          worker_id: WORKER_ID,
        })
        .eq("id", event.id);

      await processAnalyticsEvent(event);

      await supabase
        .from("event_logs")
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);

    } catch (err) {
      console.error("Analytics event failed:", err);

      await supabase
        .from("event_logs")
        .update({
          status: "failed",
          error: String(err),
        })
        .eq("id", event.id);
    }
  }
}