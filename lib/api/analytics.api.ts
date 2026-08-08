import { supabase } from "../supabase";

// ===============================
// MAIN DASHBOARD ANALYTICS
// ===============================
export async function getDashboardAnalytics() {
  const [recruitment, tasks, clocking] = await Promise.all([
    getRecruitmentAnalytics(),
    getTaskAnalytics(),
    getClockingAnalytics(),
  ]);

  return {
    recruitment,
    tasks,
    clocking,
  };
}

// ===============================
// RECRUITMENT ANALYTICS
// ===============================
async function getRecruitmentAnalytics() {
  const { data } = await supabase
    .from("recruitment_metrics")
    .select("*");

  const rows = Array.isArray(data) ? data : [];

  const funnel: Record<string, number> = {};
  const conversion: Record<string, number> = {};

  for (const item of rows) {
    const status = item?.status;
    if (!status) continue;

    funnel[status] = (funnel[status] || 0) + 1;
  }

  const keys = Object.keys(funnel);

  for (let i = 0; i < keys.length - 1; i++) {
    const a = funnel[keys[i]] || 0;
    const b = funnel[keys[i + 1]] || 0;

    conversion[`${keys[i]}→${keys[i + 1]}`] =
      a > 0 ? Number(((b / a) * 100).toFixed(1)) : 0;
  }

  return {
    funnel,
    conversion,
  };
}

// ===============================
// TASK ANALYTICS
// ===============================
async function getTaskAnalytics() {
  const { data } = await supabase
    .from("task_metrics")
    .select("*");

  const rows = Array.isArray(data) ? data : [];

  const total = rows.length;

  const completed = rows.filter((t) => t?.status === "completed").length;
  const active = rows.filter((t) => t?.status === "active").length;

  const priorityBreakdown = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const t of rows) {
    const priority = t?.priority;

    if (priority && priority in priorityBreakdown) {
      priorityBreakdown[
        priority as keyof typeof priorityBreakdown
      ] += 1;
    }
  }

  return {
    total,
    completed,
    active,
    completionRate:
      total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
    priorityBreakdown,
  };
}

// ===============================
// CLOCKING ANALYTICS
// ===============================
async function getClockingAnalytics() {
  const { data } = await supabase
    .from("clocking_metrics")
    .select("*");

  const rows = Array.isArray(data) ? data : [];

  const totalMinutes = rows.reduce(
    (sum: number, item: any) =>
      sum + (Number(item?.duration_minutes) || 0),
    0
  );

  const totalHours = totalMinutes / 60;

  const activeUsers = new Set(
    rows.map((item) => item?.user_id).filter(Boolean)
  ).size;

  const avgHours =
    rows.length > 0 ? totalHours / rows.length : 0;

  return {
    totalHours: Number(totalHours.toFixed(2)),
    activeUsers,
    avgSessionHours: Number(avgHours.toFixed(2)),
  };
}