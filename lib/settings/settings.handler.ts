import { supabase } from "../supabase";

export async function handleSettingsEvent(event: any) {
  const { tenant_id, user_id, settings } = event.payload;

  const { error } = await supabase.from("settings").upsert({
    tenant_id,
    user_id,
    settings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Settings update failed:", error);
  }
}