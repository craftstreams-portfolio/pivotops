import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/**
 * lib/huddles/transferHost.ts
 *
 * Lets the current host hand control to another participant - e.g. if they
 * need to leave mid-huddle. Every downstream host check (Time It's
 * requireHost, the idle-timeout auto-end, the remove-participant button)
 * reads voice_rooms.created_by fresh each time rather than caching who the
 * host is, so this single update propagates correctly everywhere with no
 * further changes needed.
 */
export async function transferHost(params: {
  roomId: string; tenantId: string; fromUserId: string; toUserId: string;
}): Promise<void> {
  const admin = getAdmin();

  const { data: room } = await admin.from("voice_rooms").select("created_by").eq("id", params.roomId).maybeSingle();
  if (!room || room.created_by !== params.fromUserId) {
    throw new Error("Only the current host can transfer host.");
  }

  const { error } = await admin.from("voice_rooms")
    .update({ created_by: params.toUserId })
    .eq("id", params.roomId);
  if (error) throw new Error(error.message);

  await admin.from("time_it_events").insert({
    tenant_id: params.tenantId, room_id: params.roomId, participant_id: params.toUserId,
    event_type: "host_transferred", metadata: { from: params.fromUserId, to: params.toUserId },
  });
}