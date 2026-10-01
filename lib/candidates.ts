import { supabase } from "./supabase";

export async function updateCandidateStatus(
  id: string,
  status: string
) {
  const { data, error } = await supabase
    .from("candidates")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Update error:", error.message);
    return null;
  }

  return data;
}