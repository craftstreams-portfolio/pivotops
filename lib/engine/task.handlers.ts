import { supabase } from "../supabase";

// ===============================
// MAIN ENTRY POINT
// ===============================
export async function handleTaskEvent(event: any) {
  const { type, payload } = event;

  switch (type) {

    // ===============================
    // TASK CREATED
    // ===============================
    case "TASK_CREATED":
      return handleTaskCreated(payload);

    // ===============================
    // TASK UPDATED
    // ===============================
    case "TASK_UPDATED":
      return handleTaskUpdated(payload);

    // ===============================
    // TASK PAUSED
    // ===============================
    case "TASK_PAUSED":
      return handleTaskPaused(payload);

    // ===============================
    // TASK RESUMED
    // ===============================
    case "TASK_RESUMED":
      return handleTaskResumed(payload);

    // ===============================
    // TASK COMPLETED
    // ===============================
    case "TASK_COMPLETED":
      return handleTaskCompleted(payload);

    default:
      console.log("Unhandled task event:", type);
  }
}

// ===============================
// 1. TASK CREATION
// ===============================
async function handleTaskCreated(payload: any) {
  const { id, title, priority, due_date, assigned_to } = payload;

  await supabase.from("tasks").insert({
    id,
    title,
    priority: priority || "medium",
    status: "active",
    due_date,
    assigned_to,
    created_at: new Date().toISOString(),
  });

  await supabase.from("event_logs").insert({
    type: "TASK_INITIALIZED",
    module: "tasks",
    payload,
    status: "processed",
  });
}

// ===============================
// 2. TASK UPDATE
// ===============================
async function handleTaskUpdated(payload: any) {
  const { id, updates } = payload;

  await supabase
    .from("tasks")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

// ===============================
// 3. TASK PAUSE
// ===============================
async function handleTaskPaused(payload: any) {
  const { id } = payload;

  await supabase
    .from("tasks")
    .update({
      status: "paused",
      paused_at: new Date().toISOString(),
    })
    .eq("id", id);
}

// ===============================
// 4. TASK RESUME
// ===============================
async function handleTaskResumed(payload: any) {
  const { id } = payload;

  await supabase
    .from("tasks")
    .update({
      status: "active",
      resumed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

// ===============================
// 5. TASK COMPLETION
// ===============================
async function handleTaskCompleted(payload: any) {
  const { id } = payload;

  await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Emit completion event for analytics + spotlight later
  await supabase.from("event_logs").insert({
    type: "TASK_COMPLETED_EVENT",
    module: "tasks",
    payload,
    status: "processed",
  });
}