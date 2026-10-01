import { supabase } from "../supabase";

// ===============================
// MAIN ENTRY POINT
// ===============================
export async function handleSpotlightEvent(event: any) {
  const { type, payload } = event;

  switch (type) {

    case "SPOTLIGHT_REFRESH":
      return refreshSpotlight();

    case "SPOTLIGHT_USER_UPDATE":
      return updateUserSpotlight(payload);

    default:
      console.log("Unhandled spotlight event:", type);
  }
}

// ===============================
// REFRESH GLOBAL SPOTLIGHT
// ===============================
async function refreshSpotlight() {
  // Aggregate performance signals
  const { data: users } = await supabase.from("profiles").select("*");

  if (!users) return;

  const rankings = [];

  for (const user of users) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", user.id)
      .eq("status", "completed");

    const taskScore = tasks?.length || 0;

    const { data: hires } = await supabase
      .from("candidates")
      .select("*")
      .eq("created_by", user.id)
      .eq("status", "recruitment_review");

    const hireScore = hires?.length || 0;

    const score = taskScore * 1.2 + hireScore * 2;

    rankings.push({
      user_id: user.id,
      score,
    });
  }

  // Sort top performers
  rankings.sort((a, b) => b.score - a.score);

  await supabase.from("spotlight").upsert(
    rankings.slice(0, 20)
  );

  await supabase.from("event_logs").insert({
    type: "SPOTLIGHT_REFRESHED",
    module: "spotlight",
    payload: { count: rankings.length },
    status: "processed",
  });
}

// ===============================
// UPDATE SINGLE USER SPOTLIGHT
// ===============================
async function updateUserSpotlight(payload: any) {
  const { user_id } = payload;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", user_id)
    .eq("status", "completed");

  const score = tasks?.length || 0;

  await supabase.from("spotlight").upsert({
    user_id,
    score,
    updated_at: new Date().toISOString(),
  });
}