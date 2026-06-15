import { supabase } from "../supabase";

export async function moveToDeadQueue(
  event: any,
  reason: string
) {
  await supabase.from("dead_events").insert({
    original_event: event,
    reason,
  });
}