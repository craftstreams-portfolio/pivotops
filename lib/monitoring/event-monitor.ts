import { supabase } from "../supabase";

export async function getFailedEvents() {
  const { data } = await supabase
    .from("event_logs")
    .select("*")
    .eq("status", "failed");

  return data || [];
}