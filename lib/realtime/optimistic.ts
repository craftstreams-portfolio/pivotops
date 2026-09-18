import { supabase } from "../supabase";

/**
 * SINGLE SOURCE OF TRUTH UPDATE (STABLE + SAFE)
 */
export async function moveCandidateOptimistic(
  candidate: any,
  newStatus: string,
  tenant_id: string
) {
  // -------------------------------
  // 1. RESOLVE ID SAFELY
  // -------------------------------
  const id = candidate?.id || candidate?.candidate_id || candidate?.uuid;

  if (!id) {
    console.error("❌ Missing candidate ID", candidate);
    return null;
  }

  console.log("🚀 Moving candidate:", {
    id,
    newStatus,
    tenant_id,
  });

  // -------------------------------
  // 2. EXECUTE UPDATE
  // -------------------------------
  const { data, error } = await supabase
    .from("candidates")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id) // MUST MATCH DB COLUMN EXACTLY
    .select("id, status");

  // -------------------------------
  // 3. ERROR HANDLING
  // -------------------------------
  if (error) {
    console.error("❌ DB UPDATE FAILED:", {
      error,
      id,
      newStatus,
    });
    return null;
  }

  // -------------------------------
  // 4. VALIDATION (Supabase sometimes returns [])
  // -------------------------------
  if (!data || data.length === 0) {
    console.error("❌ NO ROW UPDATED (ID MISMATCH):", {
      id,
      newStatus,
      hint: "Check if candidates.id matches DB column exactly",
    });
    return null;
  }

  const updated = data[0];

  console.log("✅ DB UPDATE SUCCESS:", updated);

  // -------------------------------
  // 5. RETURN NORMALIZED RESULT
  // -------------------------------
  return updated;
}