import { supabase } from "../supabase";
import { rebuildSystemState } from "./state.rebuilder";

// ===============================
// LOAD SNAPSHOT (FAST PATH)
// ===============================
export async function loadSystemState(tenant_id: string) {
  // 1. get latest snapshot
  const { data: snapshot } = await supabase
    .from("state_snapshots")
    .select("*")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!snapshot?.state) {
    console.log("⚠️ No snapshot found, rebuilding...");
    return await rebuildSystemState();
  }

  // 2. return snapshot state (FAST)
  return snapshot.state;
}