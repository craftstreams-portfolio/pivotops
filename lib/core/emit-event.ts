import { supabase } from "../supabase";

export async function emitCandidateEvent(event: {
  type: string;
  payload: any;
}) {
  try {
    const { error } = await supabase.from("event_logs").insert({
      type: event.type,
      payload: event.payload,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("❌ Event emit failed:", error);
    }
  } catch (err) {
    console.error("❌ Critical event bus failure:", err);
  }
}