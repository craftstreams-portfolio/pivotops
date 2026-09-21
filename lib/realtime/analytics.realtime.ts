import { supabase } from "../supabase";

type AnalyticsCache = {
  recruitment: any;
  tasks: any;
  clocking: any;
};

// ===============================
// IN-MEMORY CACHE (SINGLE SOURCE)
// ===============================
const cache: AnalyticsCache = {
  recruitment: null,
  tasks: null,
  clocking: null,
};

// ===============================
// SUBSCRIBE TO REAL-TIME CHANGES
// ===============================
export function initAnalyticsRealtime(onUpdate?: (cache: AnalyticsCache) => void) {
  // ===============================
  // RECRUITMENT STREAM
  // ===============================
  supabase
    .channel("recruitment-metrics")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "recruitment_metrics" },
      async () => {
        await refreshRecruitment();
        onUpdate?.(cache);
      }
    )
    .subscribe();

  // ===============================
  // TASK STREAM
  // ===============================
  supabase
    .channel("task-metrics")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_metrics" },
      async () => {
        await refreshTasks();
        onUpdate?.(cache);
      }
    )
    .subscribe();

  // ===============================
  // CLOCKING STREAM
  // ===============================
  supabase
    .channel("clocking-metrics")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clocking_metrics" },
      async () => {
        await refreshClocking();
        onUpdate?.(cache);
      }
    )
    .subscribe();
}

// ===============================
// REFRESH RECRUITMENT CACHE
// ===============================
async function refreshRecruitment() {
  const { data } = await supabase
    .from("recruitment_metrics")
    .select("*");

  const rows = Array.isArray(data) ? data : [];

  const funnel: Record<string, number> = {};

  for (const item of rows) {
    if (item?.status) {
      funnel[item.status] = (funnel[item.status] || 0) + 1;
    }
  }

  cache.recruitment = { funnel };
}

// ===============================
// REFRESH TASK CACHE
// ===============================
async function refreshTasks() {
  const { data } = await supabase
    .from("task_metrics")
    .select("*");

  const rows = Array.isArray(data) ? data : [];

  const total = rows.length;
  const completed = rows.filter((t) => t?.status === "completed").length;

  cache.tasks = {
    total,
    completed,
    completionRate:
      total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
  };
}

// ===============================
// REFRESH CLOCKING CACHE
// ===============================
async function refreshClocking() {
  const { data } = await supabase
    .from("clocking_metrics")
    .select("*");

  const rows = Array.isArray(data) ? data : [];

  const totalMinutes = rows.reduce(
    (sum, item) => sum + (Number(item?.duration_minutes) || 0),
    0
  );

  cache.clocking = {
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    activeUsers: new Set(rows.map((r) => r?.user_id).filter(Boolean)).size,
  };
}

// ===============================
// GET LIVE CACHE (FOR UI)
// ===============================
export function getRealtimeAnalytics() {
  return cache;
}