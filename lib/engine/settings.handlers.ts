import { supabase } from "../supabase";

// ===============================
// MAIN ENTRY POINT
// ===============================
export async function handleSettingsEvent(event: any) {
  const { type, payload } = event;

  switch (type) {

    // ===============================
    // UPDATE SYSTEM SETTINGS
    // ===============================
    case "SETTINGS_UPDATED":
      return handleSettingsUpdate(payload);

    // ===============================
    // INITIALIZE DEFAULT SETTINGS
    // ===============================
    case "SETTINGS_INIT":
      return initializeDefaultSettings(payload);

    // ===============================
    // RESET SETTINGS
    // ===============================
    case "SETTINGS_RESET":
      return resetSettings(payload);

    default:
      console.log("Unhandled settings event:", type);
  }
}

// ===============================
// 1. UPDATE SETTINGS
// ===============================
async function handleSettingsUpdate(payload: any) {
  const { key, value, scope } = payload;

  await supabase
    .from("system_settings")
    .upsert({
      key,
      value,
      scope: scope || "global",
      updated_at: new Date().toISOString(),
    });

  await supabase.from("event_logs").insert({
    type: "SETTINGS_UPDATED_LOG",
    module: "settings",
    payload,
    status: "processed",
  });
}

// ===============================
// 2. INITIALIZE DEFAULT SETTINGS
// ===============================
async function initializeDefaultSettings(payload: any) {
  const defaults = [
    // AI BEHAVIOR
    { key: "ai_hire_threshold", value: 85 },
    { key: "ai_reject_threshold", value: 25 },

    // TASK SYSTEM
    { key: "task_bottleneck_days", value: 5 },
    { key: "task_auto_escalation", value: true },

    // INTERVIEW SYSTEM
    { key: "interview_delay_hours", value: 24 },

    // CLOCKING
    { key: "shift_auto_close", value: true },

    // SYSTEM FLAGS
    { key: "enable_auto_hiring", value: true },
    { key: "enable_ai_review", value: true },
  ];

  for (const setting of defaults) {
    await supabase.from("system_settings").upsert({
      key: setting.key,
      value: setting.value,
      scope: "global",
      updated_at: new Date().toISOString(),
    });
  }

  await supabase.from("event_logs").insert({
    type: "SETTINGS_INITIALIZED",
    module: "settings",
    payload,
    status: "processed",
  });
}

// ===============================
// 3. RESET SETTINGS
// ===============================
async function resetSettings(payload: any) {
  const { scope } = payload;

  if (scope === "global") {
    await supabase.from("system_settings").delete().neq("key", "");
  }

  await supabase.from("event_logs").insert({
    type: "SETTINGS_RESET",
    module: "settings",
    payload,
    status: "processed",
  });
}