"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { FeatureGate } from "@/app/components/FeatureGate";
import {
  Users, Clock, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Brain, Briefcase,
  MessageSquare, Shield, Activity, Zap,
  ArrowUp, ArrowDown, Minus, RefreshCw,
  ClipboardList, UserCheck, UserX, Timer,
  BarChart3, PieChart, Loader2,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface MetricCard {
  label:     string;
  value:     string | number;
  sub?:      string;
  trend?:    "up" | "down" | "flat";
  trendVal?: string;
  color:     string;
  icon:      React.ElementType;
}

interface AnalyticsData {
  // Workforce
  totalEmployees:    number;
  clockedInNow:      number;
  avgHoursThisWeek:  number;
  overtimeCount:     number;

  // Recruitment
  totalCandidates:   number;
  autoInterviewed:   number;
  manualReview:      number;
  autoRejected:      number;
  hired:             number;
  avgScore:          number;
  pipelineByDecision: { decision: string; count: number }[];
  recentCandidates:  { name: string; score: number; decision: string; role: string; created_at: string }[];

  // Tasks
  totalTasks:        number;
  completedTasks:    number;
  overdueTasks:      number;
  highRiskTasks:     number;
  tasksByStatus:     { status: string; count: number }[];

  // Communication
  totalMessages:     number;
  messagesToday:     number;
  totalMentions:     number;
  activeChannels:    number;

  // Incidents
  totalIncidents:    number;
  openIncidents:     number;
  resolvedIncidents: number;
  criticalIncidents: number;
  avgResolutionMins: number;

  // Compliance
  totalOnboarding:   number;
  completedOnboarding: number;
  complianceDocs:    number;

  // Activity feed
  recentActivity:    { type: string; title: string; description: string; created_at: string; user_name: string }[];
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d   = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `Today ${formatTime(iso)}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + formatTime(iso);
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

// ─────────────────────────────────────────
// MINI BAR CHART
// ─────────────────────────────────────────
function MiniBar({
  items,
  colorFn,
}: {
  items:   { label: string; count: number; color?: string }[];
  colorFn?: (label: string) => string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 capitalize">{item.label}</span>
            <span className="text-white font-medium">{item.count}</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                item.color ?? colorFn?.(item.label) ?? "bg-indigo-500"
              }`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// DONUT RING (SVG)
// ─────────────────────────────────────────
function DonutRing({
  value,
  max,
  color,
  label,
  size = 80,
}: {
  value: number;
  max:   number;
  color: string;
  label: string;
  size?: number;
}) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = max > 0 ? (value / max) * circ : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#27272a" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.7s ease" }} />
      </svg>
      <p className="text-xs text-zinc-500 text-center leading-tight">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────
function StatCard({ card }: { card: MetricCard }) {
  const Icon = card.icon;
  const TrendIcon = card.trend === "up"   ? ArrowUp   :
                    card.trend === "down" ? ArrowDown  : Minus;
  const trendColor = card.trend === "up"   ? "text-emerald-400" :
                     card.trend === "down" ? "text-red-400"      : "text-zinc-500";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3
                    hover:border-zinc-700 transition">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
          <Icon size={17} />
        </div>
        {card.trend && (
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon size={11} />
            <span>{card.trendVal}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{card.value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
        {card.sub && (
          <p className="text-[11px] text-zinc-600 mt-0.5">{card.sub}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color }: {
  icon:  React.ElementType;
  title: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={14} />
      </div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function AnalyticsPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [data,         setData]         = useState<AnalyticsData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date());
  const [refreshing,   setRefreshing]   = useState(false);

  const fetchAll = useCallback(async () => {
    if (tenantLoading) return;
    setRefreshing(true);

    try {
      // ── Parallel fetches ───────────────────────────────────
      const [
        profilesRes,
        clockRes,
        candidatesRes,
        tasksRes,
        messagesRes,
        mentionsRes,
        channelsRes,
        incidentsRes,
        onboardingRes,
        complianceRes,
        activityRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("clocking_logs").select("user_id, type, timestamp").eq("tenant_id", tenantId).order("timestamp", { ascending: false }).limit(500),
        supabase.from("candidates").select("name, score, decision, status, role, created_at, ai_score").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("tasks").select("id, status, done, priority, risk_level, due_date, created_at").eq("tenant_id", tenantId),
        supabase.from("messages").select("id, created_at, channel_id").eq("tenant_id", tenantId),
        supabase.from("mentions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("channels").select("id", { count: "exact", head: true }),
        supabase.from("incidents").select("id, status, severity, created_at, resolved_at, priority").eq("tenant_id", tenantId),
        supabase.from("onboarding").select("id, status").eq("tenant_id", tenantId),
        supabase.from("compliance_docs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("activities").select("type, title, description, created_at, user_name").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      ]);

      // ── Workforce ──────────────────────────────────────────
      const totalEmployees = profilesRes.count ?? 0;
      const logs           = (clockRes.data ?? []) as { user_id: string; type: string; timestamp: string }[];

      // Who is clocked in right now
      const latestByUser: Record<string, { type: string; timestamp: string }> = {};
      for (const log of logs) {
        const ex = latestByUser[log.user_id];
        if (!ex || new Date(log.timestamp) > new Date(ex.timestamp)) {
          latestByUser[log.user_id] = log;
        }
      }
      const clockedInNow = Object.values(latestByUser).filter((l) => l.type === "CLOCK_IN").length;

      // Avg hours this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekLogs = logs.filter((l) => new Date(l.timestamp) >= weekStart);

      // Build sessions per user
      let totalMins = 0;
      const userWeekLogs: Record<string, { type: string; timestamp: string }[]> = {};
      for (const log of weekLogs) {
        if (!userWeekLogs[log.user_id]) userWeekLogs[log.user_id] = [];
        userWeekLogs[log.user_id].push(log);
      }
      for (const userLogs of Object.values(userWeekLogs)) {
        const sorted = userLogs.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].type === "CLOCK_IN" && sorted[i + 1].type === "CLOCK_OUT") {
            totalMins += (new Date(sorted[i + 1].timestamp).getTime() -
                          new Date(sorted[i].timestamp).getTime()) / 60000;
            i++;
          }
        }
      }
      const uniqueUsers     = Object.keys(userWeekLogs).length;
      const avgHoursThisWeek = uniqueUsers > 0
        ? Math.round((totalMins / uniqueUsers / 60) * 10) / 10
        : 0;
      const overtimeCount = Object.values(userWeekLogs).filter((ul) => {
        let mins = 0;
        const sorted = ul.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].type === "CLOCK_IN" && sorted[i + 1].type === "CLOCK_OUT") {
            mins += (new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
            i++;
          }
        }
        return mins > 40 * 60; // > 40 hours
      }).length;

      // ── Recruitment ────────────────────────────────────────
      const candidates      = candidatesRes.data ?? [];
      const totalCandidates = candidates.length;
      const autoInterviewed = candidates.filter((c) => c.decision === "auto_interview").length;
      const manualReview    = candidates.filter((c) => c.decision === "manual_review").length;
      const autoRejected    = candidates.filter((c) => c.decision === "auto_reject").length;
      const hired           = candidates.filter((c) => c.status === "hired").length;
      const scores          = candidates.map((c) => c.ai_score ?? c.score ?? 0).filter(Boolean);
      const avgScore        = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      const decisionMap: Record<string, number> = {};
      for (const c of candidates) {
        const d = c.decision ?? "unknown";
        decisionMap[d] = (decisionMap[d] ?? 0) + 1;
      }
      const pipelineByDecision = Object.entries(decisionMap).map(([decision, count]) => ({ decision, count }));

      const recentCandidates = candidates.slice(0, 5).map((c) => ({
        name:       c.name ?? "Unknown",
        score:      c.ai_score ?? c.score ?? 0,
        decision:   c.decision ?? "—",
        role:       c.role ?? "—",
        created_at: c.created_at,
      }));

      // ── Tasks ──────────────────────────────────────────────
      const tasks         = tasksRes.data ?? [];
      const totalTasks    = tasks.length;
      const completedTasks= tasks.filter((t) => t.done || t.status === "done" || t.status === "completed").length;
      const now           = new Date();
      const overdueTasks  = tasks.filter((t) =>
        !t.done && t.due_date && new Date(t.due_date) < now
      ).length;
      const highRiskTasks = tasks.filter((t) =>
        t.risk_level === "high" || t.risk_level === "critical"
      ).length;

      const statusMap: Record<string, number> = {};
      for (const t of tasks) {
        const s = t.status ?? "unknown";
        statusMap[s] = (statusMap[s] ?? 0) + 1;
      }
      const tasksByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      // ── Communication ──────────────────────────────────────
      const msgs          = messagesRes.data ?? [];
      const totalMessages = msgs.length;
      const todayStr      = new Date().toDateString();
      const messagesToday = msgs.filter((m) => new Date(m.created_at).toDateString() === todayStr).length;
      const totalMentions = mentionsRes.count ?? 0;
      const activeChannels= channelsRes.count ?? 0;

      // ── Incidents ──────────────────────────────────────────
      const incidents        = incidentsRes.data ?? [];
      const totalIncidents   = incidents.length;
      const openIncidents    = incidents.filter((i) => i.status === "open").length;
      const resolvedIncidents= incidents.filter((i) => i.status === "resolved").length;
      const criticalIncidents= incidents.filter((i) => i.severity === "critical" || i.priority === 1).length;

      const resolvedWithTime = incidents.filter((i) => i.resolved_at && i.created_at);
      const avgResolutionMins = resolvedWithTime.length
        ? Math.round(
            resolvedWithTime.reduce((sum, i) => {
              return sum + (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()) / 60000;
            }, 0) / resolvedWithTime.length
          )
        : 0;

      // ── Compliance / Onboarding ────────────────────────────
      const onboarding          = onboardingRes.data ?? [];
      const totalOnboarding     = onboarding.length;
      const completedOnboarding = onboarding.filter((o) =>
        o.status === "completed" || o.status === "done"
      ).length;
      const complianceDocs      = complianceRes.count ?? 0;

      // ── Activity feed ──────────────────────────────────────
      const recentActivity = (activityRes.data ?? []).map((a) => ({
        type:        a.type        ?? "activity",
        title:       a.title       ?? "Activity",
        description: a.description ?? "",
        created_at:  a.created_at,
        user_name:   a.user_name   ?? "System",
      }));

      setData({
        totalEmployees,
        clockedInNow,
        avgHoursThisWeek,
        overtimeCount,
        totalCandidates,
        autoInterviewed,
        manualReview,
        autoRejected,
        hired,
        avgScore,
        pipelineByDecision,
        recentCandidates,
        totalTasks,
        completedTasks,
        overdueTasks,
        highRiskTasks,
        tasksByStatus,
        totalMessages,
        messagesToday,
        totalMentions,
        activeChannels,
        totalIncidents,
        openIncidents,
        resolvedIncidents,
        criticalIncidents,
        avgResolutionMins,
        totalOnboarding,
        completedOnboarding,
        complianceDocs,
        recentActivity,
      });

      setLastRefresh(new Date());
    } catch (err) {
      console.error("Analytics fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, tenantLoading]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime refresh on key table changes ──────────────────
  useEffect(() => {
    if (tenantLoading) return;

    const tables = ["clocking_logs", "candidates", "tasks", "incidents", "messages"];
    const channels = tables.map((table) =>
      supabase
        .channel(`analytics-${table}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table },
          () => fetchAll()
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [tenantId, tenantLoading, fetchAll]);

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading analytics...
      </div>
    );
  }

  if (!data) return null;

  const completionRate = data.totalTasks > 0
    ? Math.round((data.completedTasks / data.totalTasks) * 100)
    : 0;

  const decisionColorMap: Record<string, string> = {
    auto_interview: "bg-emerald-500",
    manual_review:  "bg-amber-500",
    auto_reject:    "bg-red-500",
    unknown:        "bg-zinc-600",
  };

  const taskStatusColorMap: Record<string, string> = {
    done:        "bg-emerald-500",
    completed:   "bg-emerald-500",
    "in-progress":"bg-indigo-500",
    pending:     "bg-amber-500",
    blocked:     "bg-red-500",
    todo:        "bg-zinc-500",
  };

  return (
    <FeatureGate tenantId={tenantId} feature="analytics" title="Analytics">
    <div className="p-4 md:p-6 max-w-7xl space-y-8">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Realtime workforce intelligence · Updated {formatRelative(lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700
                     hover:border-zinc-600 text-zinc-400 hover:text-white text-sm transition
                     disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── TOP KPI ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          {
            label:    "Total Employees",
            value:    data.totalEmployees,
            sub:      `${data.clockedInNow} clocked in now`,
            color:    "bg-indigo-500/15 text-indigo-400",
            icon:     Users,
            trend:    "flat" as const,
          },
          {
            label:    "Avg Hours / Week",
            value:    `${data.avgHoursThisWeek}h`,
            sub:      `${data.overtimeCount} on overtime`,
            color:    "bg-emerald-500/15 text-emerald-400",
            icon:     Clock,
            trend:    data.avgHoursThisWeek > 40 ? "up" as const : "flat" as const,
            trendVal: data.avgHoursThisWeek > 40 ? "OT" : undefined,
          },
          {
            label:    "Open Incidents",
            value:    data.openIncidents,
            sub:      `${data.criticalIncidents} critical`,
            color:    data.openIncidents > 0 ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-400",
            icon:     AlertTriangle,
            trend:    data.openIncidents > 0 ? "down" as const : "flat" as const,
            trendVal: data.openIncidents > 0 ? `${data.openIncidents} open` : undefined,
          },
          {
            label:    "Task Completion",
            value:    `${completionRate}%`,
            sub:      `${data.completedTasks} of ${data.totalTasks} tasks`,
            color:    completionRate >= 70 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400",
            icon:     CheckCircle2,
            trend:    completionRate >= 70 ? "up" as const : "down" as const,
            trendVal: `${completionRate}%`,
          },
        ] as MetricCard[]).map((card) => (
          <StatCard key={card.label} card={card} />
        ))}
      </div>

      {/* ── WORKFORCE + RECRUITMENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Workforce */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <SectionHeader icon={Users} title="Workforce" color="bg-indigo-500/15 text-indigo-400" />

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total",      value: data.totalEmployees,   color: "text-white"        },
              { label: "Clocked In", value: data.clockedInNow,     color: "text-emerald-400"  },
              { label: "Overtime",   value: data.overtimeCount,    color: "text-amber-400"    },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Clocked in bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Currently clocked in</span>
              <span>{pct(data.clockedInNow, data.totalEmployees)}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: pct(data.clockedInNow, data.totalEmployees) }}
              />
            </div>

            <div className="flex justify-between text-xs text-zinc-500 mt-3">
              <span>Avg hours this week</span>
              <span className={data.avgHoursThisWeek > 40 ? "text-amber-400" : "text-white"}>
                {data.avgHoursThisWeek}h
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  data.avgHoursThisWeek > 40 ? "bg-amber-500" : "bg-indigo-500"
                }`}
                style={{ width: `${Math.min((data.avgHoursThisWeek / 50) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recruitment */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <SectionHeader icon={Briefcase} title="Recruitment Pipeline" color="bg-purple-500/15 text-purple-400" />

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Total",      value: data.totalCandidates, color: "text-white"        },
              { label: "Avg Score",  value: `${data.avgScore}/100`, color: "text-indigo-400" },
              { label: "Interviews", value: data.autoInterviewed,   color: "text-emerald-400"},
              { label: "Hired",      value: data.hired,             color: "text-emerald-400"},
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <MiniBar
            items={data.pipelineByDecision.map((d) => ({
              label: d.decision.replace("_", " "),
              count: d.count,
              color: decisionColorMap[d.decision] ?? "bg-zinc-500",
            }))}
          />
        </div>
      </div>

      {/* ── TASKS + COMMUNICATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tasks */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <SectionHeader icon={ClipboardList} title="Task Operations" color="bg-amber-500/15 text-amber-400" />

          <div className="flex items-center gap-6 mb-5">
            <DonutRing
              value={data.completedTasks}
              max={data.totalTasks}
              color="#10b981"
              label="Complete"
              size={90}
            />
            <div className="flex-1 space-y-3">
              {[
                { label: "Total Tasks",    value: data.totalTasks,     color: "text-white"       },
                { label: "Completed",      value: data.completedTasks, color: "text-emerald-400" },
                { label: "Overdue",        value: data.overdueTasks,   color: "text-red-400"     },
                { label: "High Risk",      value: data.highRiskTasks,  color: "text-orange-400"  },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{label}</span>
                  <span className={`font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <MiniBar
            items={data.tasksByStatus.map((t) => ({
              label: t.status,
              count: t.count,
              color: taskStatusColorMap[t.status] ?? "bg-zinc-500",
            }))}
          />
        </div>

        {/* Communication */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <SectionHeader icon={MessageSquare} title="Communication" color="bg-blue-500/15 text-blue-400" />

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Total Messages",  value: data.totalMessages,  color: "text-white"       },
              { label: "Today",           value: data.messagesToday,  color: "text-blue-400"    },
              { label: "Mentions",        value: data.totalMentions,  color: "text-indigo-400"  },
              { label: "Channels",        value: data.activeChannels, color: "text-zinc-300"    },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Messages today vs total</span>
              <span>{pct(data.messagesToday, data.totalMessages)}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{ width: pct(data.messagesToday, data.totalMessages) }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── INCIDENTS + COMPLIANCE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Incidents */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <SectionHeader icon={AlertTriangle} title="Incidents" color="bg-red-500/15 text-red-400" />

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Total",        value: data.totalIncidents,    color: "text-white"       },
              { label: "Open",         value: data.openIncidents,     color: "text-red-400"     },
              { label: "Resolved",     value: data.resolvedIncidents, color: "text-emerald-400" },
              { label: "Critical",     value: data.criticalIncidents, color: "text-orange-400"  },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <DonutRing
              value={data.resolvedIncidents}
              max={data.totalIncidents}
              color="#10b981"
              label="Resolved"
              size={80}
            />
            <div className="flex-1">
              <p className="text-xs text-zinc-500 mb-1">Resolution rate</p>
              <p className="text-2xl font-bold text-white">
                {pct(data.resolvedIncidents, data.totalIncidents)}
              </p>
              {data.avgResolutionMins > 0 && (
                <p className="text-xs text-zinc-500 mt-1">
                  Avg resolution:{" "}
                  <span className="text-white">
                    {data.avgResolutionMins > 60
                      ? `${Math.round(data.avgResolutionMins / 60)}h`
                      : `${data.avgResolutionMins}m`}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Compliance + Onboarding */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <SectionHeader icon={Shield} title="Compliance & Onboarding" color="bg-emerald-500/15 text-emerald-400" />

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Onboarding",   value: data.totalOnboarding,     color: "text-white"      },
              { label: "Completed",    value: data.completedOnboarding, color: "text-emerald-400"},
              { label: "Comp. Docs",   value: data.complianceDocs,      color: "text-indigo-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Onboarding completion</span>
                <span>{pct(data.completedOnboarding, data.totalOnboarding)}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: pct(data.completedOnboarding, data.totalOnboarding) }}
                />
              </div>
            </div>
          </div>

          {/* Recent candidates */}
          {data.recentCandidates.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
                Recent Candidates
              </p>
              <div className="space-y-1.5">
                {data.recentCandidates.slice(0, 4).map((c, i) => (
                  <div key={i}
                    className="flex items-center justify-between gap-2 px-3 py-2
                               rounded-lg bg-zinc-800/40 border border-zinc-700/30">
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{c.role}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-indigo-400">{c.score}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold
                        ${c.decision === "auto_interview"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : c.decision === "manual_review"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                            : "bg-red-500/15 text-red-400 border-red-500/25"
                        }`}>
                        {c.decision === "auto_interview" ? "Interview"
                          : c.decision === "manual_review" ? "Review"
                          : "Rejected"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTIVITY FEED ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <SectionHeader icon={Activity} title="Live Activity Feed" color="bg-zinc-700 text-zinc-300" />

        {data.recentActivity.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm border border-dashed
                          border-zinc-800 rounded-xl">
            No recent activity
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentActivity.map((act, i) => (
              <div key={i}
                className="flex items-start gap-3 px-4 py-3 rounded-xl
                           border border-zinc-800/50 bg-zinc-800/20
                           hover:border-zinc-700 transition">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20
                                flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap size={12} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white font-medium truncate">{act.title}</p>
                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5
                                     rounded flex-shrink-0">
                      {act.type}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{act.description}</p>
                  )}
                  <p className="text-[10px] text-zinc-700 mt-0.5">
                    {act.user_name} · {formatRelative(act.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </FeatureGate>
  );
}
