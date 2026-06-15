import { supabase } from "../supabase";

export async function getDashboardMetrics() {
  const [
    candidates,
    tasks,
    failedEvents,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("event_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  return {
    candidates: candidates.count || 0,
    tasks: tasks.count || 0,
    failedEvents: failedEvents.count || 0,
  };
}