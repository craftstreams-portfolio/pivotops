import { supabase } from "../supabase";

// ===============================
// MAIN ENTRY POINT
// ===============================
export async function handleShowcaseEvent(event: any) {
  const { type, payload } = event;

  switch (type) {

    case "SHOWCASE_BUILD":
      return buildShowcase(payload);

    case "SHOWCASE_REFRESH":
      return refreshShowcase(payload);

    default:
      console.log("Unhandled showcase event:", type);
  }
}

// ===============================
// BUILD USER SHOWCASE
// ===============================
async function buildShowcase(payload: any) {
  const { user_id } = payload;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", user_id)
    .eq("status", "completed");

  const { data: hires } = await supabase
    .from("candidates")
    .select("*")
    .eq("created_by", user_id)
    .eq("status", "recruitment_review");

  const showcase = {
    user_id,
    completed_tasks: tasks || [],
    successful_hires: hires || [],
    total_tasks: tasks?.length || 0,
    total_hires: hires?.length || 0,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("showcase").upsert(showcase);

  await supabase.from("event_logs").insert({
    type: "SHOWCASE_BUILT",
    module: "showcase",
    payload,
    status: "processed",
  });
}

// ===============================
// REFRESH SHOWCASE
// ===============================
async function refreshShowcase(payload: any) {
  const { user_id } = payload;

  await buildShowcase({ user_id });
}