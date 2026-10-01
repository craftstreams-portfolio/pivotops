import { supabase } from "../supabase";

// ===============================
// DEFAULT SYSTEM SETTINGS
// ===============================
export const defaultSettings = {
  ai_enabled: true,
  auto_move_candidates: true,
  auto_reject_enabled: false,
  chat_realtime_enabled: true,
  analytics_refresh_rate: 30, // seconds
};

// ===============================
// GET SETTINGS
// ===============================
export async function getSettings(tenant_id: string) {
  const { data } = await supabase
    .from("system_settings")
    .select("*")
    .eq("tenant_id", tenant_id)
    .single();

  return data || defaultSettings;
}

// ===============================
// UPDATE SETTINGS
// ===============================
export async function updateSettings(
  tenant_id: string,
  updates: Partial<typeof defaultSettings>
) {
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      tenant_id,
      ...updates,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Settings update failed:", error);
  }
}

// ===============================
// FEATURE CHECKER
// ===============================
export function isEnabled(settings: any, key: keyof typeof defaultSettings) {
  return settings?.[key] ?? defaultSettings[key];
}