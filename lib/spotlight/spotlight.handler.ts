import { supabase } from "../supabase";

export async function handleSpotlightEvent(event: any) {
  const {
    tenant_id,
    user_id,
    reason,
    created_by,
  } = event.payload;

  const expires_at = new Date();
  expires_at.setHours(expires_at.getHours() + 24);

  const { error } = await supabase.from("spotlights").insert({
    tenant_id,
    user_id,
    reason,
    created_by,
    expires_at: expires_at.toISOString(),
  });

  if (error) {
    console.error("❌ Spotlight failed:", error);
  }
}