import { supabase } from "../supabase";

export async function handleClockingEvent(event: any) {
  const { user_id, tenant_id } = event.payload;

  const type =
    event.type === "USER_CLOCKED_IN" ? "IN" : "OUT";

  const { error } = await supabase.from("clocking_logs").insert({
    user_id,
    tenant_id,
    type,
    timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Clocking failed:", error);
  }
}