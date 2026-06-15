import { supabase } from "../supabase";

// ===============================
// ENTRY POINT
// ===============================
export async function processAnalyticsEvent(event: any) {
  if (!event) return;

  const { type, payload } = event;

  switch (type) {

    // ===============================
    // RECRUITMENT METRICS UPDATE
    // ===============================
    case "RECRUITMENT_METRIC_UPDATE":
      return updateRecruitmentMetrics(payload);

    // ===============================
    // TASK METRICS UPDATE
    // ===============================
    case "TASK_METRIC_UPDATE":
      return updateTaskMetrics(payload);

    // ===============================
    // CLOCKING METRICS UPDATE
    // ===============================
    case "CLOCKING_METRIC_UPDATE":
      return updateClockingMetrics(payload);

    default:
      console.log("Unknown analytics event:", type);
      return null;
  }
}

// ===============================
// STEP 3: RECRUITMENT METRICS
// ===============================
async function updateRecruitmentMetrics(payload: any) {
  if (!payload) return;

  const { candidate_id, status } = payload;

  try {
    await supabase.from("recruitment_metrics").insert({
      candidate_id,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Recruitment metrics error:", err);
  }
}

// ===============================
// STEP 4: TASK METRICS
// ===============================
async function updateTaskMetrics(payload: any) {
  if (!payload) return;

  const { task_id, status, priority } = payload;

  try {
    await supabase.from("task_metrics").insert({
      task_id,
      status,
      priority,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Task metrics error:", err);
  }
}

// ===============================
// STEP 5: CLOCKING METRICS
// ===============================
async function updateClockingMetrics(payload: any) {
  if (!payload) return;

  const { user_id, duration_minutes } = payload;

  try {
    await supabase.from("clocking_metrics").insert({
      user_id,
      duration_minutes,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Clocking metrics error:", err);
  }
}