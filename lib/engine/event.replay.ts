import { supabase } from "../supabase";
import { processEvent } from "./workforce.engine";

// ===============================
// REPLAY EVENT TYPE
// ===============================
type ReplayEventRow = {
  type: string;
  payload?: unknown;
  created_at?: string;
  id?: string;
  event_id?: string;
  status?: string;
};

/**
 * REBUILD ENTIRE SYSTEM STATE FROM EVENT LOGS
 * (Used for recovery, debugging, or cold start)
 */
export async function replayEventHistory(tenant_id: string): Promise<void> {
  const { data, error } = await supabase
    .from("event_logs")
    .select("*")
    .eq("payload->>tenant_id", tenant_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Replay fetch failed:", error);
    return;
  }

  if (!data?.length) {
    console.warn("⚠️ No events to replay");
    return;
  }

  console.log(`♻️ Replaying ${data.length} events...`);

  for (const event of data as ReplayEventRow[]) {
    if (!event?.type) {
      console.warn("⚠️ Skipping invalid replay event:", event);
      continue;
    }

    await processEvent({
      id: event.id,
      event_id: event.event_id,
      type: event.type,
      payload: event.payload,
      status: event.status,
      _replay: true,
    });
  }

  console.log("✅ Replay complete");
}