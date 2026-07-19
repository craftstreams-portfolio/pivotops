import { buildSessions } from "../clocking/sessions";
/**
 * ============================================
 * XAVIER AI — Workforce Intelligence Engine
 * Fatigue Detection & Overtime Analysis
 * ============================================
 */

export type FatigueLevel =
  | "optimal"
  | "moderate"
  | "warning"
  | "high"
  | "critical";

export type DayType = "weekday" | "saturday" | "sunday";

export interface DailySummary {
  date:        string;
  dayType:     DayType;
  hoursWorked: number;
  isOvertime:  boolean;
  sessions:    { clockIn: string; clockOut: string; durationMins: number }[];
}

export interface XavierFatigueReport {
  employeeId:     string;
  weekStart:      string;
  weekEnd:        string;
  regularHours:   number;
  overtimeHours:  number;
  totalHours:     number;
  todayHours:     number;
  fatigueLevel:   FatigueLevel;
  fatigueScore:   number;
  alert:          boolean;
  headline:       string;
  insight:        string;
  recommendation: string;
  dailySummaries: DailySummary[];
  analyzedAt:     string;
}

export interface ClockLogInput {
  id:        string;
  user_id:   string;
  type:      "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  timestamp: string;
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d    = new Date(date);
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayType(date: Date): DayType {
  const day = date.getDay();
  if (day === 6) return "saturday";
  if (day === 0) return "sunday";
  return "weekday";
}

function fatigueFromHours(totalHours: number): {
  level: FatigueLevel;
  score: number;
} {
  if (totalHours >= 56) return { level: "critical", score: 100 };
  if (totalHours >= 48) return { level: "high",     score: 80  };
  if (totalHours >= 40) return { level: "warning",  score: 60  };
  if (totalHours >= 32) return { level: "moderate", score: 35  };
  return                       { level: "optimal",  score: 10  };
}

function xavierMessage(
  level:         FatigueLevel,
  totalHours:    number,
  overtimeHours: number,
  name:          string
): { headline: string; insight: string; recommendation: string } {
  const first = name.split(" ")[0];

  switch (level) {
    case "critical":
      return {
        headline:       `⚠️ Critical fatigue detected — ${totalHours.toFixed(1)} hrs this week`,
        insight:        `${first} has logged ${overtimeHours.toFixed(1)} overtime hours this week, significantly exceeding safe working limits. Sustained overwork at this level increases error rates and health risk.`,
        recommendation: "Immediate rest period recommended. Consider redistributing workload and reviewing scheduling.",
      };
    case "high":
      return {
        headline:       `🔴 High fatigue — ${totalHours.toFixed(1)} hrs this week`,
        insight:        `${first} is ${overtimeHours.toFixed(1)} hours over the standard 40-hr week. Weekend hours are contributing to cumulative fatigue.`,
        recommendation: "Reduce weekend shifts. Ensure minimum 11-hour rest between sessions.",
      };
    case "warning":
      return {
        headline:       `🟡 Overtime threshold reached — ${totalHours.toFixed(1)} hrs this week`,
        insight:        `${first} has crossed the 40-hour standard workweek. Any additional hours this week are classified as overtime.`,
        recommendation: "Monitor closely. Avoid scheduling additional weekend shifts this week.",
      };
    case "moderate":
      return {
        headline:       `🟢 On track — ${totalHours.toFixed(1)} hrs this week`,
        insight:        `${first} is within healthy working range. ${(40 - totalHours).toFixed(1)} hours remaining before overtime threshold.`,
        recommendation: "Maintain current schedule. No action required.",
      };
    default:
      return {
        headline:       `✅ Optimal — ${totalHours.toFixed(1)} hrs this week`,
        insight:        `${first} is well within safe working hours this week.`,
        recommendation: "No action needed. Xavier is monitoring.",
      };
  }
}

export function analyzeEmployeeFatigue(
  employeeId:    string,
  employeeName:  string,
  logs:          ClockLogInput[],
  referenceDate: Date = new Date(),
  paidBreaks:    boolean = false
): XavierFatigueReport {
  const { start: weekStart, end: weekEnd } = getWeekBounds(referenceDate);

  const weekLogs = logs
    .filter((l) => {
      const t = new Date(l.timestamp);
      return t >= weekStart && t <= weekEnd;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Sessions come from the shared builder so break time is subtracted and an
  // open shift still counts up to now. Pairing here directly would treat a
  // BREAK_START as the end of the shift.
  const sessions = buildSessions(weekLogs as any, Date.now(), { paidBreaks }).map((s) => ({
    clockIn:      s.in.timestamp,
    clockOut:     s.out?.timestamp ?? new Date().toISOString(),
    durationMins: Math.round(s.netMs / 60000),
    date:         toYMD(new Date(s.in.timestamp)),
  }));

  const byDate: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  const dailySummaries: DailySummary[] = Object.entries(byDate).map(
    ([date, daySessions]) => {
      const dayDate     = new Date(date + "T12:00:00");
      const dayType     = getDayType(dayDate);
      const totalMins   = daySessions.reduce((sum, s) => sum + s.durationMins, 0);
      const hoursWorked = totalMins / 60;
      const isOvertime  = dayType !== "weekday" || hoursWorked > 8;

      return {
        date,
        dayType,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        isOvertime,
        sessions: daySessions.map((s) => ({
          clockIn:      s.clockIn,
          clockOut:     s.clockOut,
          durationMins: s.durationMins,
        })),
      };
    }
  );

  let regularHours  = 0;
  let overtimeHours = 0;

  for (const day of dailySummaries as DailySummary[]) {
    if (day.dayType === "weekday") {
      regularHours  += Math.min(day.hoursWorked, 8);
      overtimeHours += Math.max(0, day.hoursWorked - 8);
    } else {
      overtimeHours += day.hoursWorked;
    }
  }

  const totalHours = regularHours + overtimeHours;

  const todayKey     = toYMD(referenceDate);
  const todaySummary = dailySummaries.find((d) => d.date === todayKey);
  const todayHours   = todaySummary?.hoursWorked ?? 0;

  const { level: fatigueLevel, score: fatigueScore } = fatigueFromHours(totalHours);

  const alert = fatigueLevel === "warning" ||
                fatigueLevel === "high"    ||
                fatigueLevel === "critical";

  const messages = xavierMessage(fatigueLevel, totalHours, overtimeHours, employeeName);

  return {
    employeeId,
    weekStart:     toYMD(weekStart),
    weekEnd:       toYMD(weekEnd),
    regularHours:  Math.round(regularHours  * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    totalHours:    Math.round(totalHours    * 10) / 10,
    todayHours:    Math.round(todayHours    * 10) / 10,
    fatigueLevel,
    fatigueScore,
    alert,
    ...messages,
    dailySummaries: dailySummaries.sort((a, b) => a.date.localeCompare(b.date)),
    analyzedAt:    new Date().toISOString(),
  };
}
