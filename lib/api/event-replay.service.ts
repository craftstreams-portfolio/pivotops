import { supabase } from "../supabase";
import { processEvent } from "../engine/workforce.engine";

// ===============================
// REPLAY BY FILTER
// ===============================
export async function replayEvents(filter: {
  tenant_id?: string;
  type?: string;
  status?: string;
}) {
  let query = supabase.from("event_logs").select("*");

  if (filter.tenant_id) {
    query = query.eq("payload->tenant_id", filter.tenant_id);
  }

  if (filter.type) {
    query = query.eq("type", filter.type);
  }

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("❌ replay query failed:", error);
    return;
  }

  for (const event of data) {
    await processEvent({
      id: event.id,
      event_id: event.id,
      type: event.type,
      payload: event.payload,
      status: "replay",
    });
  }

  return { replayed: data.length };
}