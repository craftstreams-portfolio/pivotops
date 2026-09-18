import { supabase } from "../supabase";
import { rebuildSystemState } from "./state.rebuilder";

// ===============================
// CREATE SNAPSHOT
// ===============================
export async function createSnapshot(tenant_id: string) {
  const state = await rebuildSystemState();

  // get latest event timestamp
  const { data: latestEvent } = await supabase
    .from("event_logs")
    .select("created_at")
    .eq("status", "processed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const snapshot = {
    tenant_id,
    state,
    last_event_time: latestEvent?.created_at || new Date().toISOString(),
  };

  const { error } = await supabase
    .from("state_snapshots")
    .insert(snapshot);

  if (error) {
    console.error("❌ Snapshot creation failed:", error);
    return null;
  }

  console.log("📸 Snapshot created");
  return snapshot;
}