import { supabase } from "../supabase";

// ===============================
// GET SINGLE CANDIDATE TIMELINE
// ===============================
export async function getCandidateTimeline(candidate_id: string) {
  const { data, error } = await supabase
    .from("event_logs")
    .select("*")
    .contains("payload", { candidate_id })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ timeline fetch failed:", error);
    return [];
  }

  return data || [];
}