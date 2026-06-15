import { supabase } from "../supabase";
import { processEvent } from "../engine/workforce.engine";

export async function recoverFailedEvents() {
  const { data: failed } = await supabase
    .from("event_logs")
    .select("*")
    .eq("status", "failed")
    .limit(50);

  if (!failed?.length) return;

  for (const event of failed) {
    try {
      await processEvent(event);

      await supabase
        .from("event_logs")
        .update({ status: "processed" })
        .eq("id", event.id);

    } catch (err) {
      console.error("❌ Recovery failed:", event.id, err);
    }
  }
}