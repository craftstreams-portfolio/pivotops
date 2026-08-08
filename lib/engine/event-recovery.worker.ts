import { supabase } from "../supabase";

// ===============================
// RECOVERY LOGIC
// ===============================
export async function recoverFailedEvents() {
  try {
    const { data, error } = await supabase
      .from("event_logs")
      .select("*")
      .eq("status", "failed")
      .limit(20);

    if (error) {
      console.error("❌ Recovery fetch failed:", error);
      return;
    }

    if (!data || data.length === 0) return;

    for (const event of data) {
      await supabase
        .from("event_logs")
        .update({
          status: "queued",
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);
    }

    console.log(`♻️ Recovered ${data.length} failed events`);
  } catch (err) {
    console.error("❌ recoverFailedEvents crashed:", err);
  }
}

// ===============================
// WORKER LOOP
// ===============================
setInterval(() => {
  recoverFailedEvents();
}, 60 * 1000);