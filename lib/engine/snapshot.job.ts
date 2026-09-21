import { supabase } from "../supabase";
import { writeSnapshot } from "./snapshot.writer";
import { rebuildFromEvents } from "./state.rebuilder";

// ===============================
// SNAPSHOT GENERATION JOB
// ===============================
export async function generateSnapshot(tenant_id = "default") {
  const now = new Date().toISOString();

  const state = await rebuildFromEvents(now, tenant_id);

  await writeSnapshot(tenant_id, now, state);

  console.log("📦 Snapshot saved:", now);
}