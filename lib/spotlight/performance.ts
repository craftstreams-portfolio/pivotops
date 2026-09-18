import type { SupabaseClient } from "@supabase/supabase-js";

export interface MetricValue {
  available: boolean;
  value: number | null;
  detail?: string;
}

export interface PerformanceBreakdown {
  user_id: string;
  month: string;
  generated_at: string;
  attendance: { days_present: MetricValue; hours_worked: MetricValue };
  punctuality: { on_time_rate: MetricValue; late_count: MetricValue; absent_count: MetricValue };
  recruitment: { closing_rate: MetricValue; hires: MetricValue };
  productivity: { tasks_completed: MetricValue };
  response_time: { avg_minutes: MetricValue };
}

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

const NA: MetricValue = { available: false, value: null };

export async function buildPerformanceBreakdown(db: SupabaseClient, userId: string, tenantId: string, month: string): Promise<PerformanceBreakdown> {
  const { start, end } = monthRange(month);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data: logs } = await db.from("clocking_logs")
    .select("type, timestamp").eq("tenant_id", tenantId).eq("user_id", userId)
    .gte("timestamp", startIso).lt("timestamp", endIso).order("timestamp", { ascending: true });
  const { data: schedules } = await db.from("schedules")
    .select("start_time, end_time").eq("tenant_id", tenantId).eq("user_id", userId);

  const clockLogs = (logs ?? []) as { type: string; timestamp: string }[];
  const sessions: { in: Date; out: Date | null }[] = [];
  for (let i = 0; i < clockLogs.length; i++) {
    if (clockLogs[i].type === "CLOCK_IN") {
      const next = clockLogs[i + 1];
      sessions.push({ in: new Date(clockLogs[i].timestamp), out: next && next.type === "CLOCK_OUT" ? new Date(next.timestamp) : null });
      if (next && next.type === "CLOCK_OUT") i++;
    }
  }
  const daysPresent = new Set(sessions.map(s => s.in.toISOString().slice(0, 10))).size;
  let totalMs = 0;
  for (const s of sessions) if (s.out) totalMs += s.out.getTime() - s.in.getTime();
  const hoursWorked = Math.round((totalMs / 3600000) * 10) / 10;

  const attendance = {
    days_present: clockLogs.length > 0 ? { available: true, value: daysPresent, detail: `${daysPresent} day${daysPresent === 1 ? "" : "s"} clocked in` } : NA,
    hours_worked: sessions.some(s => s.out) ? { available: true, value: hoursWorked, detail: `${hoursWorked}h logged` } : NA,
  };

  const hasSchedules = (schedules ?? []).length > 0;
  let punctuality;
  if (!hasSchedules) {
    punctuality = { on_time_rate: NA, late_count: NA, absent_count: NA };
  } else {
    let late = 0, onTime = 0;
    const firstByDay: Record<string, Date> = {};
    for (const s of sessions) {
      const d = s.in.toISOString().slice(0, 10);
      if (!firstByDay[d] || s.in < firstByDay[d]) firstByDay[d] = s.in;
    }
    const schedMins = (schedules ?? []).map(sc => { const t = new Date(sc.start_time); return t.getUTCHours() * 60 + t.getUTCMinutes(); });
    const earliest = schedMins.length ? Math.min(...schedMins) : null;
    for (const d of Object.keys(firstByDay)) {
      if (earliest === null) continue;
      const ci = firstByDay[d];
      const m = ci.getUTCHours() * 60 + ci.getUTCMinutes();
      if (m > earliest + 5) late++; else onTime++;
    }
    const scored = late + onTime;
    punctuality = {
      on_time_rate: scored > 0 ? { available: true, value: Math.round((onTime / scored) * 100), detail: `${onTime}/${scored} on time` } : NA,
      late_count: scored > 0 ? { available: true, value: late, detail: `${late} late arrival${late === 1 ? "" : "s"}` } : NA,
      absent_count: NA,
    };
  }

  const { data: created } = await db.from("candidates")
    .select("status, hired_at").eq("tenant_id", tenantId).eq("created_by", userId)
    .gte("created_at", startIso).lt("created_at", endIso);
  const cRows = (created ?? []) as { status: string }[];
  const totalCreated = cRows.length;
  const hiredCount = cRows.filter(c => c.status === "hired").length;
  const recruitment = {
    closing_rate: totalCreated > 0 ? { available: true, value: Math.round((hiredCount / totalCreated) * 100), detail: `${hiredCount}/${totalCreated} hired` } : NA,
    hires: totalCreated > 0 ? { available: true, value: hiredCount, detail: `${hiredCount} hire${hiredCount === 1 ? "" : "s"}` } : NA,
  };

  const { data: tasks } = await db.from("tasks")
    .select("status, done").eq("tenant_id", tenantId).eq("assigned_to", userId)
    .gte("updated_at", startIso).lt("updated_at", endIso);
  const tRows = (tasks ?? []) as { status: string; done: boolean }[];
  const completed = tRows.filter(t => t.done || t.status === "completed" || t.status === "done").length;
  const productivity = {
    tasks_completed: tRows.length > 0 ? { available: true, value: completed, detail: `${completed} completed` } : NA,
  };

  const { data: respEvents } = await db.from("response_events")
    .select("response_minutes").eq("tenant_id", tenantId).eq("user_id", userId)
    .gte("responded_at", startIso).lt("responded_at", endIso);
  const rEvents = (respEvents ?? []) as { response_minutes: number }[];
  const avgResp = rEvents.length > 0
    ? Math.round((rEvents.reduce((s, e) => s + Number(e.response_minutes), 0) / rEvents.length) * 10) / 10
    : null;
  const response_time = {
    avg_minutes: rEvents.length > 0
      ? { available: true, value: avgResp, detail: `across ${rEvents.length} response${rEvents.length === 1 ? "" : "s"}` }
      : NA,
  };

  return { user_id: userId, month, generated_at: new Date().toISOString(), attendance, punctuality, recruitment, productivity, response_time };
}