import { supabase } from "../supabase";
import { emitCandidateEvent } from "./event-bus";

// ===============================
// SAFE CANDIDATE UPDATE
// ===============================
export async function updateCandidateStatusSafe(
  candidate_id: string,
  status: string,
  tenant_id: string,
  user?: any
) {
  if (!candidate_id) {
    console.error("❌ Missing candidate_id");
    return;
  }

  const { data, error } = await supabase
    .from("candidates")
    .update({
      status,
      last_stage_change: new Date().toISOString(),
    })
    .eq("id", candidate_id)
    .select("id, status");

  if (error) {
    console.error("❌ UPDATE ERROR:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.error("❌ No rows updated (ID mismatch):", candidate_id);
    return;
  }

  // ===============================
  // EMIT EVENT (FIXED CONTRACT)
  // ===============================
  await emitCandidateEvent({
    type: "CANDIDATE_STATUS_CHANGED",
    payload: {
      candidate_id,
      status,
      tenant_id,
      actor: {
        id: user?.id ?? "system",
        email: user?.email ?? null,
        name: user?.email ?? "System",
      },
      timestamp: new Date().toISOString(),
    },
  });
}