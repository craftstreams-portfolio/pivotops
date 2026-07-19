"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { buildSessions, getLiveStatus, splitSession, type WorkSession } from "@/lib/clocking/sessions";
import { zonedWallClockToUtc, formatInZone, zoneAbbr } from "@/lib/time/zones";
import { startBreak, endBreak } from "@/lib/clocking/clocking.service";
import { supabase } from "@/lib/supabase";
import { logEmployeeRecord } from "@/lib/records/log";
import { useTenant } from "@/lib/hooks/useTenant";
import { FeatureGate } from "@/app/components/FeatureGate";
import { clockIn, clockOut, getClockingLogs } from "@/lib/clocking/clocking.service";
import { analyzeEmployeeFatigue, type XavierFatigueReport, type FatigueLevel } from "../../../lib/ai/xavier";
import {
  LogIn, LogOut, Clock, Timer, Brain,
  AlertTriangle, CheckCircle2, AlertCircle,
  TrendingUp, Calendar, FileText, User,
  ChevronLeft, ChevronRight, Plus, X,
  Send, Edit3, Globe, Loader2,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface ClockLog {
  id:        string;
  user_id:   string;
  type:      "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  timestamp: string;
  tenant_id: string;
  timezone?: string | null;
  location?: string | null;
  shift_id?: string | null;
  metadata?: Record<string, any> | null;
}

interface Profile {
  id:           string;
  full_name:    string | null;
  email:        string | null;
  department:   string | null;
  position:     string | null;
  role:         string | null;
  avatar_url:   string | null;
  tenant_id:    string | null;
  timezone?:    string | null;
  phone?:       string | null;
  location?:    string | null;
  work_mode?:   string | null;
  date_joined?: string | null;
}

interface Schedule {
  id:         string;
  tenant_id:  string;
  user_id:    string;
  title:      string;
  start_time: string;
  end_time:   string;
  timezone:   string;
  repeat:     string | null;
  color:      string | null;
  created_at: string;
}

interface TimesheetCorrection {
  id:            string;
  tenant_id:     string;
  employee_id:   string;
  log_id:        string | null;
  requested_at:  string;
  reason:        string;
  proposed_time: string | null;
  status:        string;
  reviewed_by:   string | null;
  reviewed_at:   string | null;
  manager_note:  string | null;
}

type Tab = "personal" | "schedules" | "timesheet" | "live";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function formatDuration(ms: number) {
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string | null, email: string | null) {
  if (name) {
    const p = name.trim().split(" ");
    return p.length >= 2
      ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
      : p[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

function getWeekDates(date: Date): Date[] {
  const d    = new Date(date);
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return x;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()  === b.getMonth()  &&
    a.getDate()   === b.getDate();
}

const FATIGUE_STYLES: Record<string, {
  border: string; bg: string; text: string; badge: string; icon: React.ElementType;
}> = {
  optimal:  { border: "border-emerald-500/20", bg: "bg-emerald-500/5",  text: "text-emerald-400", badge: "bg-emerald-500/15 border-emerald-500/25", icon: CheckCircle2  },
  moderate: { border: "border-blue-500/20",    bg: "bg-blue-500/5",     text: "text-blue-400",    badge: "bg-blue-500/15 border-blue-500/25",       icon: TrendingUp    },
  warning:  { border: "border-amber-500/30",   bg: "bg-amber-500/5",    text: "text-amber-400",   badge: "bg-amber-500/15 border-amber-500/25",     icon: AlertTriangle },
  high:     { border: "border-orange-500/30",  bg: "bg-orange-500/5",   text: "text-orange-400",  badge: "bg-orange-500/15 border-orange-500/25",   icon: AlertTriangle },
  critical: { border: "border-red-500/30",     bg: "bg-red-500/5",      text: "text-red-400",     badge: "bg-red-500/15 border-red-500/25",         icon: AlertCircle   },
};

const SCHEDULE_COLORS = [
  "#6366f1","#8b5cf6","#06b6d4","#10b981",
  "#f59e0b","#ef4444","#ec4899","#3b82f6",
];

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
interface Toast { id: string; type: "success" | "error" | "info"; message: string; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const colors = {
    success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    error:   "bg-red-500/15 border-red-500/30 text-red-300",
    info:    "bg-blue-500/15 border-blue-500/30 text-blue-300",
  };
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm shadow-lg ${colors[t.type]}`}>
          {t.type === "success" ? <CheckCircle2 size={15} className="flex-shrink-0" /> :
           t.type === "error"   ? <AlertCircle  size={15} className="flex-shrink-0" /> :
                                  <Brain        size={15} className="flex-shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
function ClockingPageInner() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [currentUser,   setCurrentUser]   = useState<Profile | null>(null);
  const [clockedIn,     setClockedIn]     = useState(false);
  // Tenant break policy. Paid breaks count toward worked hours; unpaid are deducted.
  const [paidBreaks, setPaidBreaks] = useState(false);
  const [overtimeEnabled, setOvertimeEnabled] = useState(true);
  useEffect(() => {
    if (tenantLoading || !tenantId) return;
    (async () => {
      const { data } = await supabase
        .from("workspace_settings")
        .select("paid_breaks, overtime_enabled")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      setPaidBreaks(data?.paid_breaks === true);
      setOvertimeEnabled(data?.overtime_enabled !== false);
    })();
  }, [tenantId, tenantLoading]);
  const [onBreak,       setOnBreak]       = useState(false);
  const [breakStart,    setBreakStart]    = useState<string | null>(null);
  const [breakElapsed,  setBreakElapsed]  = useState(0);
  const [liveRoster,    setLiveRoster]    = useState<{
    user: Profile; status: "in" | "break"; since: string; netMs: number;
  }[]>([]);
  const [clockInTime,   setClockInTime]   = useState<string | null>(null);
  const [elapsed,       setElapsed]       = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [allLogs,       setAllLogs]       = useState<ClockLog[]>([]);
  const [xavierReport,  setXavierReport]  = useState<XavierFatigueReport | null>(null);
  const [toasts,        setToasts]        = useState<Toast[]>([]);
  const [activeTab,     setActiveTab]     = useState<Tab>("personal");

  // Schedules
  const [schedules,       setSchedules]       = useState<Schedule[]>([]);
  const [calendarDate,    setCalendarDate]     = useState(new Date());
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule,     setNewSchedule]     = useState({
    title:      "Work Day",
    date:       new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time:   "17:00",
    timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
    repeat:     "none",
    color:      "#6366f1",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Timesheet
  const [corrections,          setCorrections]          = useState<TimesheetCorrection[]>([]);
  const [showCorrection,        setShowCorrection]        = useState(false);
  const [correctionForm,        setCorrectionForm]        = useState({ log_id: "", reason: "", proposed_time: "" });
  const [submittingCorrection,  setSubmittingCorrection]  = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Toast ──────────────────────────────
  const showToast = (type: Toast["type"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  };

  // ── Load current user ──────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (data) setCurrentUser(data);
    };
    load();
  }, []);

  // ── Load logs ──────────────────────────
  const loadLogs = useCallback(async () => {
    if (tenantLoading) return [] as ClockLog[];
    try {
      const logs = await getClockingLogs(tenantId, 200);
      setAllLogs(logs as ClockLog[]);
      return logs as ClockLog[];
    } catch {
      return [] as ClockLog[];
    }
  }, [tenantId, tenantLoading]);

  // ── Check clock status + Xavier ────────
  useEffect(() => {
    if (!currentUser || tenantLoading) return;
    const check = async () => {
      const logs = await loadLogs();
      const myLogs = logs
        .filter((l) => l.user_id === currentUser.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      // Break-aware: the most recent row may be a BREAK_START, which the old
      // check read as "not clocked in" and wiped the running shift on refresh.
      const live = getLiveStatus(myLogs as any, Date.now(), { paidBreaks });
      if (live.status !== "out" && live.session) {
        setClockedIn(true);
        setClockInTime(live.session.in.timestamp);
        setElapsed(Date.now() - new Date(live.session.in.timestamp).getTime());
        setOnBreak(live.status === "break");
        setBreakStart(live.breakStart);
        setBreakElapsed(live.breakStart ? Date.now() - new Date(live.breakStart).getTime() : 0);
      } else {
        setClockedIn(false);
        setOnBreak(false);
        setBreakStart(null);
        setBreakElapsed(0);
      }
      const report = analyzeEmployeeFatigue(
        currentUser.id,
        currentUser.full_name ?? currentUser.email ?? currentUser.id,
        myLogs,
        new Date(),
        paidBreaks,
        schedules,
        overtimeEnabled
      );
      setXavierReport(report);
    };
    check();
    // paidBreaks is a dep: it loads asynchronously, and without it the fatigue
    // report and clock status would keep the values computed before the tenant
    // policy arrived.
  }, [currentUser, tenantId, tenantLoading, paidBreaks, schedules, overtimeEnabled]);

  // ── Load schedules ─────────────────────
  const loadSchedules = useCallback(async () => {
    if (!currentUser || tenantLoading) return;
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id",   currentUser.id)
      .eq("tenant_id", tenantId)
      .order("start_time", { ascending: true });
    if (data) setSchedules(data as Schedule[]);
  }, [currentUser, tenantId, tenantLoading]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  // ── Load corrections ───────────────────
  const loadCorrections = useCallback(async () => {
    if (!currentUser || tenantLoading) return;
    const isMgr = currentUser.role === "admin" || currentUser.role === "manager";
    // Managers see every correction in the tenant (to approve); everyone else sees their own.
    let q = supabase
      .from("timesheet_corrections")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("requested_at", { ascending: false });
    if (!isMgr) q = q.eq("employee_id", currentUser.id);
    const { data } = await q;
    if (data) setCorrections(data as TimesheetCorrection[]);
  }, [currentUser, tenantId, tenantLoading]);

  useEffect(() => { loadCorrections(); }, [loadCorrections]);

  // ── Timer ──────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (clockedIn && clockInTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - new Date(clockInTime).getTime());
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [clockedIn, clockInTime]);

  // Tenant profiles, so the roster can show names rather than user ids.

  const [rosterProfiles, setRosterProfiles] = useState<Record<string, Profile>>({});
  useEffect(() => {
    if (tenantLoading || !tenantId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, department, position, role, avatar_url, timezone")
        .eq("tenant_id", tenantId);
      const map: Record<string, Profile> = {};
      for (const p of (data ?? []) as any[]) map[p.id] = p as Profile;
      setRosterProfiles(map);
    })();
  }, [tenantId, tenantLoading]);

  // Who is on shift right now, derived from the same logs the realtime channel
  // refreshes — so it updates the moment anyone clocks in, breaks, or leaves.
  const [rosterTick, setRosterTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRosterTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const onShift = (() => {
    void rosterTick; // re-derive elapsed times on the tick
    const byUser: Record<string, any[]> = {};
    for (const l of allLogs) {
      if (!byUser[l.user_id]) byUser[l.user_id] = [];
      byUser[l.user_id].push(l);
    }
    const rows: { userId: string; status: "in" | "break"; since: string; netMs: number; breakMs: number }[] = [];
    for (const [userId, logs] of Object.entries(byUser)) {
      const live = getLiveStatus(logs as any, Date.now(), { paidBreaks });
      if (live.status === "out" || !live.session) continue;
      rows.push({
        userId,
        status:  live.status,
        since:   live.since ?? live.session.in.timestamp,
        netMs:   live.session.netMs,
        breakMs: live.session.breakMs,
      });
    }
    return rows.sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());
  })();

  // Break timer ticks independently of the shift timer.
  useEffect(() => {
    if (!onBreak || !breakStart) return;
    const id = setInterval(() => {
      setBreakElapsed(Date.now() - new Date(breakStart).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [onBreak, breakStart]);

  // ── Realtime ───────────────────────────
  useEffect(() => {
    if (tenantLoading || !currentUser) return;
    const ch = supabase
      .channel("clocking-live")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "clocking_logs" },
        async () => { await loadLogs(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, tenantLoading, currentUser, loadLogs]);

  // ── Clock In ───────────────────────────
  const handleClockIn = async () => {
    if (!currentUser || actionLoading) return;

    // Block clocking if no schedules have been set up at all
    if (schedules.length === 0) {
      showToast("error", "No schedules found. Go to the Schedules tab and add your work schedule before clocking in.");
      setActiveTab("schedules");
      return;
    }

    // Block if no schedule is active right now
    const now = new Date();
    const active = schedules.find((s) => {
      const start = new Date(s.start_time);
      const end   = new Date(s.end_time);
      return now >= start && now <= end;
    });
    if (!active) {
      showToast("error", "No active schedule for this time window. Check your Schedules tab.");
      return;
    }

    setActionLoading(true);
    try {
      await clockIn({
        user_id:   currentUser.id,
        tenant_id: tenantId,
        timezone:  currentUser.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const now = new Date().toISOString();
      setClockedIn(true);
      setClockInTime(now);
      setElapsed(0);
      showToast("success", `✅ Clocked in at ${formatTime(now)}`);
      await loadLogs();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Break ──────────────────────────────
  const handleToggleBreak = async () => {
    if (!currentUser || actionLoading || !clockedIn) return;
    setActionLoading(true);
    try {
      if (onBreak) {
        const mins = breakStart
          ? Math.round((Date.now() - new Date(breakStart).getTime()) / 60000)
          : undefined;
        await endBreak({
          user_id: currentUser.id, tenant_id: tenantId,
          timezone: currentUser.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          breakMinutes: mins,
        });
        setOnBreak(false);
        setBreakStart(null);
        setBreakElapsed(0);
        showToast("success", `▶️ Back on shift${mins ? ` · ${mins} min break` : ""}`);
      } else {
        const iso = new Date().toISOString();
        await startBreak({
          user_id: currentUser.id, tenant_id: tenantId,
          timezone: currentUser.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setOnBreak(true);
        setBreakStart(iso);
        setBreakElapsed(0);
        showToast("success", `☕ Break started at ${formatTime(iso)}`);
      }
      await loadLogs();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Clock Out ──────────────────────────
  const handleClockOut = async () => {
    if (!currentUser || actionLoading) return;
    setActionLoading(true);
    const sessionMins = clockInTime
      ? Math.round((Date.now() - new Date(clockInTime).getTime()) / 60000)
      : undefined;
    try {
      await clockOut({
        user_id:        currentUser.id,
        tenant_id:      tenantId,
        sessionMinutes: sessionMins,
        timezone:       currentUser.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setClockedIn(false);
      setClockInTime(null);
      setElapsed(0);
      // Clocking out while on break closes the break too — buildSessions seals
      // the open break at the clock-out time, so no orphaned break is left.
      setOnBreak(false);
      setBreakStart(null);
      setBreakElapsed(0);
      showToast("success", `👋 Clocked out${sessionMins ? ` · ${sessionMins} min session` : ""}`);
      const fresh = await loadLogs();

      // Record the finished shift against the roster. Regular and overtime are
      // written as separate rows so a payslip dispute can be traced to one of
      // them rather than a single blended figure.
      try {
        const mine = fresh.filter((l) => l.user_id === currentUser.id);
        const built = buildSessions(mine as any, Date.now(), { paidBreaks });
        const done = [...built].reverse().find((s) => s.out);
        if (done) {
          const { regularMs, overtimeMs, scheduledMs } =
            splitSession(done, schedules as any, overtimeEnabled);
          const hrs = (ms: number) => (ms / 3600000).toFixed(1);

          await logEmployeeRecord({
            tenantId,
            userId:    currentUser.id,
            kind:      "timesheet",
            title:     `Shift completed · ${hrs(regularMs)}h regular`,
            detail:    `${formatTime(done.in.timestamp)} to ${formatTime(done.out!.timestamp)}` +
                       (done.breakMs > 0
                          ? ` · ${Math.round(done.breakMs / 60000)}m break${paidBreaks ? " (paid)" : " deducted"}`
                          : ""),
            createdBy: currentUser.id,
          });

          if (overtimeEnabled && overtimeMs > 60000) {
            await logEmployeeRecord({
              tenantId,
              userId:    currentUser.id,
              kind:      "overtime",
              title:     `Overtime · ${hrs(overtimeMs)}h`,
              detail:    scheduledMs === null
                ? "Worked with no schedule rostered for this day."
                : `Beyond the ${hrs(scheduledMs)}h rostered window.`,
              createdBy: currentUser.id,
            });
          }
        }
      } catch { /* logging must never block a clock-out */ }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Add Schedule ───────────────────────
  const handleAddSchedule = async () => {
    if (!currentUser || savingSchedule) return;
    setSavingSchedule(true);
    try {
      // Resolve against the zone the user selected, not the browser's — otherwise
      // rostering "09:00 America/New_York" from Lagos would store 09:00 Lagos.
      const zone = newSchedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startISO = zonedWallClockToUtc(newSchedule.date, newSchedule.start_time, zone).toISOString();
      let   endDate  = zonedWallClockToUtc(newSchedule.date, newSchedule.end_time,   zone);
      const startDate = new Date(startISO);
      // An end earlier than the start means the shift runs past midnight.
      if (endDate.getTime() <= startDate.getTime()) {
        endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      }
      const endISO = endDate.toISOString();
      const { error } = await supabase.from("schedules").insert({
        user_id:    currentUser.id,
        tenant_id:  tenantId,
        title:      newSchedule.title,
        start_time: startISO,
        end_time:   endISO,
        timezone:   newSchedule.timezone,
        repeat:     newSchedule.repeat === "none" ? null : newSchedule.repeat,
        color:      newSchedule.color,
      });
      if (error) throw new Error(error.message);
      showToast("success", "Schedule saved");
      setShowAddSchedule(false);
      await loadSchedules();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSchedule(false);
    }
  };

  // ── Delete Schedule ────────────────────
  const handleDeleteSchedule = async (id: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) { showToast("error", error.message); return; }
    showToast("success", "Schedule removed");
    await loadSchedules();
  };

  // ── Approve / Decline Correction (manager) ──
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleResolveCorrection = async (
    c: TimesheetCorrection,
    decision: "approved" | "rejected",
    note?: string
  ) => {
    if (!currentUser || processingId) return;
    setProcessingId(c.id);
    try {
      const nowIso = new Date().toISOString();

      if (decision === "approved" && c.proposed_time && c.log_id) {
        // The correction references the session's CLOCK_IN (log_id). Find whether
        // that session already has a CLOCK_OUT, then fix or insert it.
        const { data: inLog } = await supabase
          .from("clocking_logs").select("*").eq("id", c.log_id).single();

        if (inLog) {
          // The session's CLOCK_OUT, if it exists. Filtering by type matters now
          // that break rows share this table — "the next row" could be a
          // BREAK_START, which would wrongly look like a missing clock-out and
          // insert a duplicate.
          const { data: after } = await supabase
            .from("clocking_logs")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("user_id", inLog.user_id)
            .eq("type", "CLOCK_OUT")
            .gt("timestamp", inLog.timestamp)
            .order("timestamp", { ascending: true })
            .limit(1);
          const nextLog = after?.[0];

          if (nextLog) {
            await supabase.from("clocking_logs")
              .update({ timestamp: c.proposed_time })
              .eq("id", nextLog.id);
          } else {
            await supabase.from("clocking_logs").insert({
              tenant_id: tenantId,
              user_id:   inLog.user_id,
              type:      "CLOCK_OUT",
              timestamp: c.proposed_time,
              timezone:  inLog.timezone ?? null,
            });
          }

          // Log the reconciliation onto the employee's record.
          const when = new Date(c.proposed_time).toLocaleString();
          await logEmployeeRecord({
            tenantId,
            userId:    inLog.user_id,
            kind:      "timesheet",
            title:     "Timesheet corrected",
            detail:    `Clock-out set to ${when}. ${c.reason ? `Reason: ${c.reason}` : ""}`.trim(),
            createdBy: currentUser.id,
          });
        }
      }

      await supabase.from("timesheet_corrections").update({
        status:       decision,
        reviewed_by:  currentUser.id,
        reviewed_at:  nowIso,
        manager_note: note?.trim() || null,
      }).eq("id", c.id);

      showToast("success", decision === "approved" ? "Correction applied to timesheet" : "Correction declined");
      await Promise.all([loadCorrections(), loadLogs()]);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  // ── Submit Correction ──────────────────
  const handleSubmitCorrection = async () => {
    if (!currentUser || submittingCorrection || !correctionForm.reason.trim()) return;
    setSubmittingCorrection(true);
    try {
      const { error } = await supabase.from("timesheet_corrections").insert({
        employee_id:   currentUser.id,
        tenant_id:     tenantId,
        log_id:        correctionForm.log_id || null,
        reason:        correctionForm.reason.trim(),
        proposed_time: correctionForm.proposed_time
          ? new Date(correctionForm.proposed_time).toISOString()
          : null,
        status:       "pending",
        requested_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      showToast("success", "Correction request sent to your manager");
      setShowCorrection(false);
      setCorrectionForm({ log_id: "", reason: "", proposed_time: "" });
      await loadCorrections();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // ─────────────────────────────────────
  if (tenantLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  const fatigueStyle = xavierReport
    ? (FATIGUE_STYLES[xavierReport.fatigueLevel] ?? FATIGUE_STYLES.optimal)
    : null;

  const weekDates = getWeekDates(new Date(calendarDate));
  const myLogs    = allLogs.filter((l) => l.user_id === currentUser.id);

  // Break-aware sessions. The old loop paired a CLOCK_IN with the very next log,
  // which a BREAK_START would hijack — leaving the session looking unclosed.
  const workSessions = buildSessions(myLogs as any, Date.now(), { paidBreaks });
  const sessions = workSessions.map((s) => ({
    in:  s.in  as unknown as ClockLog,
    out: (s.out ?? null) as unknown as ClockLog | null,
    breakMs: s.breakMs,
    netMs:   s.netMs,
  }));

  const todayStr = new Date().toLocaleDateString([], {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <ToastContainer toasts={toasts} />

      <div className="relative p-4 md:p-6 max-w-4xl space-y-6">
        <style>{`
          @keyframes pv-tick { from { opacity: .55; } to { opacity: 1; } }
          @keyframes pv-sweep { from { transform: translateX(-120%); } to { transform: translateX(240%); } }
        `}</style>
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -top-32 left-1/4 w-[440px] h-[440px] rounded-full opacity-[0.10] blur-[110px]"
               style={{ background: "radial-gradient(circle,#10B981 0%,transparent 70%)" }} />
          <div className="absolute top-1/2 -right-24 w-[360px] h-[360px] rounded-full opacity-[0.07] blur-[110px]"
               style={{ background: "radial-gradient(circle,#6366F1 0%,transparent 70%)" }} />
        </div>

        {/* ── ZIRA-STYLE CLOCK WIDGET ── */}
        <div className="relative rounded-2xl p-[1px] transition-all duration-500 overflow-hidden"
          style={{
            background: !clockedIn
              ? "linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))"
              : onBreak
                ? "linear-gradient(135deg,rgba(245,158,11,0.45),rgba(245,158,11,0.08))"
                : "linear-gradient(135deg,rgba(16,185,129,0.45),rgba(16,185,129,0.08))",
          }}>
          <div className="relative rounded-[15px] bg-[#0c0e14]/95 backdrop-blur-sm p-6 overflow-hidden">
            {clockedIn && (
              <div className="pointer-events-none absolute -top-24 -right-16 w-56 h-56 rounded-full opacity-20 blur-3xl"
                   style={{ background: `radial-gradient(circle,${onBreak ? "#F59E0B" : "#10B981"},transparent 70%)` }} />
            )}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

            {/* Identity */}
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center
                              text-xl font-bold flex-shrink-0 transition-colors overflow-hidden
                ${clockedIn ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                {currentUser.avatar_url
                  ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  : getInitials(currentUser.full_name, currentUser.email)
                }
              </div>
              <div>
                <p className="text-white font-semibold">{currentUser.full_name ?? currentUser.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {currentUser.position   && <span className="text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{currentUser.position}</span>}
                  {currentUser.department && <span className="text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">{currentUser.department}</span>}
                  {currentUser.role       && <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">{currentUser.role}</span>}
                </div>
                <div className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border
                  ${clockedIn
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                    : "bg-zinc-800 text-zinc-500 border-zinc-700"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${clockedIn ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                  {!clockedIn
                    ? "🔴 Offline"
                    : onBreak
                      ? `☕ On break · ${formatDuration(breakElapsed)}`
                      : `🟢 Working · since ${clockInTime ? formatTime(clockInTime) : "—"}`
                  }
                </div>
              </div>
            </div>

            {/* Timer + Action */}
            <div className="flex flex-col items-start md:items-end gap-3">
              <div className="flex flex-col items-start md:items-end gap-1">
                <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-600">
                  <Timer size={11} className={clockedIn ? (onBreak ? "text-amber-400" : "text-emerald-400") : "text-zinc-700"} />
                  {onBreak ? "Shift paused" : clockedIn ? "Elapsed" : "Not clocked in"}
                </span>
                <span className="text-[42px] leading-none font-mono font-bold tabular-nums tracking-tight"
                      style={{
                        color: !clockedIn ? "#3F3F46" : onBreak ? "#FCD34D" : "#FFFFFF",
                        animation: clockedIn && !onBreak ? "pv-tick 2s ease-in-out infinite alternate" : "none",
                      }}>
                  {formatDuration(elapsed)}
                </span>
              </div>

              {xavierReport && (
                <p className="text-xs text-zinc-500">
                  Today: <span className="text-white font-medium">{xavierReport.todayHours}h</span>
                  {" · "}
                  Week: <span className={
                    ["warning","high","critical"].includes(xavierReport.fatigueLevel)
                      ? "text-amber-400 font-medium" : "text-white font-medium"
                  }>{xavierReport.totalHours}h</span>
                  {xavierReport.overtimeHours > 0 && (
                    <span className="text-amber-400"> (+{xavierReport.overtimeHours}h OT)</span>
                  )}
                </p>
              )}

              <div className="flex items-center gap-2">
                {clockedIn && (
                  <button
                    onClick={handleToggleBreak}
                    disabled={actionLoading}
                    className={`flex items-center gap-2 px-5 py-3.5 rounded-xl font-semibold
                                text-sm transition-all disabled:opacity-50 border
                      ${onBreak
                        ? "bg-amber-500 hover:bg-amber-400 text-[#231A04] border-amber-400"
                        : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                    {onBreak
                      ? <>▶️ {actionLoading ? "…" : `End break · ${formatDuration(breakElapsed)}`}</>
                      : <>☕ {actionLoading ? "…" : "Break"}</>
                    }
                  </button>
                )}
                <button
                  onClick={clockedIn ? handleClockOut : handleClockIn}
                  disabled={actionLoading}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold
                              text-sm transition-all disabled:opacity-50 shadow-lg
                    ${clockedIn
                      ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                      : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
                    }`}>
                  {clockedIn
                    ? <><LogOut size={16} />{actionLoading ? "Clocking out..." : "Clock Out"}</>
                    : <><LogIn  size={16} />{actionLoading ? "Clocking in..."  : "Clock In" }</>
                  }
                </button>
              </div>

              <p className="text-[10px] text-zinc-600">{todayStr}</p>
            </div>
          </div>

          {/* Xavier insight strip */}
          {xavierReport && fatigueStyle && (
            <div className={`relative mt-5 flex items-center gap-3 px-4 py-3 rounded-xl border ${fatigueStyle.badge}`}>
              <Brain size={14} className={fatigueStyle.text} />
              <p className={`text-xs leading-relaxed ${fatigueStyle.text}`}>{xavierReport.recommendation}</p>
            </div>
          )}
          </div>
        </div>

        {/* ── PROFILE TABS ── */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0c0e14]/80 backdrop-blur-sm overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06] overflow-x-auto">
            {([
              { id: "personal",  label: "Personal Data", icon: User     },
              { id: "schedules", label: "Schedules",     icon: Calendar },
              { id: "timesheet", label: "Timesheet",     icon: FileText },
              ...((currentUser.role === "admin" || currentUser.role === "manager")
                ? [{ id: "live" as Tab, label: `On shift (${onShift.length})`, icon: Clock }]
                : []),
            ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2
                            whitespace-nowrap flex-shrink-0
                  ${activeTab === id
                    ? "border-emerald-500 text-white bg-white/[0.03]"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                  }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* ── ON SHIFT NOW (managers) ── */}
          {activeTab === "live" && (currentUser.role === "admin" || currentUser.role === "manager") && (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {onShift.length === 0
                    ? "Nobody is on shift right now."
                    : `${onShift.length} on shift · ${onShift.filter((r) => r.status === "break").length} on break`}
                </p>
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>

              {onShift.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
                  <Clock size={24} className="text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-600 text-sm">Clock-ins will appear here as they happen.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {onShift.map((r) => {
                    const p = rosterProfiles[r.userId];
                    const name = p?.full_name ?? p?.email ?? r.userId;
                    const mins = Math.floor((Date.now() - new Date(r.since).getTime()) / 60000);
                    return (
                      <div key={r.userId}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition
                          ${r.status === "break"
                            ? "border-amber-500/25 bg-amber-500/[0.04]"
                            : "border-emerald-500/20 bg-emerald-500/[0.03]"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                                          flex-shrink-0 overflow-hidden
                            ${r.status === "break" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                            {p?.avatar_url
                              ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                              : getInitials(p?.full_name ?? null, p?.email ?? null)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{name}</p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {p?.position ?? p?.department ?? "—"}
                              {r.breakMs > 0 && ` · ${Math.round(r.breakMs / 60000)}m on break this shift`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border
                            ${r.status === "break"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${r.status === "break" ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
                            {r.status === "break" ? "On break" : "Working"}
                          </span>
                          <p className="text-[10px] text-zinc-600 mt-1">
                            {r.status === "break" ? "since" : "worked"}{" "}
                            {r.status === "break"
                              ? `${mins}m`
                              : formatDuration(r.netMs)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PERSONAL DATA TAB ── */}
          {activeTab === "personal" && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: "Full Name",   value: currentUser.full_name },
                  { label: "Email",       value: currentUser.email },
                  { label: "Phone",       value: currentUser.phone       ?? "—" },
                  { label: "Department",  value: currentUser.department  ?? "—" },
                  { label: "Position",    value: currentUser.position    ?? "—" },
                  { label: "Role",        value: currentUser.role        ?? "—" },
                  { label: "Work Mode",   value: currentUser.work_mode   ?? "—" },
                  { label: "Location",    value: currentUser.location    ?? "—" },
                  { label: "Timezone",    value: currentUser.timezone    ?? Intl.DateTimeFormat().resolvedOptions().timeZone },
                  { label: "Date Joined", value: currentUser.date_joined ? formatDate(currentUser.date_joined) : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm text-white">{value ?? "—"}</p>
                  </div>
                ))}
              </div>

              {/* Xavier fatigue summary */}
              {xavierReport && fatigueStyle && (
                <div className={`rounded-xl border ${fatigueStyle.border} ${fatigueStyle.bg} p-4 space-y-3`}>
                  <div className="flex items-center gap-2">
                    <Brain size={14} className={fatigueStyle.text} />
                    <span className={`text-xs font-semibold ${fatigueStyle.text} uppercase tracking-wider`}>
                      Xavier AI · Fatigue Analysis
                    </span>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${fatigueStyle.badge} ${fatigueStyle.text}`}>
                      {xavierReport.fatigueLevel}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Today",    value: `${xavierReport.todayHours}h`    },
                      { label: "Regular",  value: `${xavierReport.regularHours}h`  },
                      { label: "Overtime", value: `${xavierReport.overtimeHours}h` },
                      { label: "Total",    value: `${xavierReport.totalHours}h`    },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-black/20 border border-white/[0.06] p-2 text-center">
                        <p className="text-sm font-bold text-white">{value}</p>
                        <p className="text-[9px] text-white/30 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700
                        ${xavierReport.fatigueLevel === "critical" ? "bg-red-500"    :
                          xavierReport.fatigueLevel === "high"     ? "bg-orange-500" :
                          xavierReport.fatigueLevel === "warning"  ? "bg-amber-500"  :
                          xavierReport.fatigueLevel === "moderate" ? "bg-blue-500"   :
                          "bg-emerald-500"}`}
                      style={{ width: `${xavierReport.fatigueScore}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/50">{xavierReport.insight}</p>
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULES TAB ── */}
          {activeTab === "schedules" && (
            <div className="p-6 space-y-5">

              {/* Calendar nav */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const d = new Date(calendarDate); d.setDate(d.getDate() - 7); setCalendarDate(new Date(d)); }}
                    className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition"
                  >
                    <ChevronLeft size={14} className="text-zinc-400" />
                  </button>
                  <span className="text-sm font-semibold text-white px-2">
                    {weekDates[0].toLocaleDateString([], { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => { const d = new Date(calendarDate); d.setDate(d.getDate() + 7); setCalendarDate(new Date(d)); }}
                    className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition"
                  >
                    <ChevronRight size={14} className="text-zinc-400" />
                  </button>
                </div>
                <button
                  onClick={() => setShowAddSchedule(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600
                             hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  <Plus size={12} /> Add Schedule
                </button>
              </div>

              {/* Week grid */}
              <div className="grid grid-cols-7 gap-1">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                  <div key={d} className="text-center text-[10px] text-zinc-600 font-medium pb-1">{d}</div>
                ))}
                {weekDates.map((date) => {
                  const isToday      = isSameDay(date, new Date());
                  const daySchedules = schedules.filter((s) => isSameDay(new Date(s.start_time), date));
                  return (
                    <div
                      key={date.toISOString()}
                      onClick={() => {
                        setNewSchedule((p) => ({ ...p, date: date.toISOString().slice(0, 10) }));
                        setShowAddSchedule(true);
                      }}
                      className={`min-h-[80px] rounded-xl border p-2 cursor-pointer transition
                        ${isToday
                          ? "border-indigo-500/40 bg-indigo-500/5"
                          : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-700"
                        }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${isToday ? "text-indigo-400" : "text-zinc-500"}`}>
                        {date.getDate()}
                      </p>
                      {daySchedules.map((s) => (
                        <div
                          key={s.id}
                          onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}
                          className="text-[9px] px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer hover:opacity-70 transition"
                          style={{
                            backgroundColor: (s.color ?? "#6366f1") + "33",
                            color: s.color ?? "#6366f1",
                            border: `1px solid ${s.color ?? "#6366f1"}44`,
                          }}
                          title={`${s.title} · ${formatTime(s.start_time)}–${formatTime(s.end_time)} · Click to remove`}
                        >
                          {formatTime(s.start_time)} {s.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Upcoming list */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Upcoming Schedules</p>
                {schedules.filter((s) => new Date(s.end_time) >= new Date()).length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
                    No upcoming schedules. Click a day or use Add Schedule.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules
                      .filter((s) => new Date(s.end_time) >= new Date())
                      .slice(0, 10)
                      .map((s) => (
                        <div key={s.id}
                          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                                     border border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color ?? "#6366f1" }} />
                            <div className="min-w-0">
                              <p className="text-sm text-white font-medium truncate">{s.title}</p>
                              <p className="text-xs text-zinc-500">
                                {formatDate(s.start_time)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                              <Globe size={10} />
                              <span className="hidden sm:block truncate max-w-[80px]">{s.timezone}</span>
                            </div>
                            {s.repeat && (
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                                {s.repeat}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="w-6 h-6 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition"
                            >
                              <X size={11} className="text-zinc-600 hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TIMESHEET TAB ── */}
          {activeTab === "timesheet" && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  {sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded
                </p>
                <button
                  onClick={() => setShowCorrection(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700
                             hover:border-zinc-600 text-zinc-400 hover:text-white text-xs font-medium transition"
                >
                  <Edit3 size={12} /> Request Correction
                </button>
              </div>

              {/* Sessions list */}
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
                  No timesheet entries yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...sessions].reverse().map(({ in: inLog, out: outLog, breakMs, netMs }) => {
                    // Net of breaks, so a row agrees with the weekly total.
                    const dur = outLog ? netMs : null;
                    return (
                      <div key={inLog.id}
                        className="flex items-center justify-between gap-4 rounded-xl border
                                   border-zinc-800 bg-zinc-800/30 px-4 py-3 hover:border-zinc-700 transition"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm text-white font-medium">{formatDate(inLog.timestamp)}</p>
                          <p className="text-xs text-zinc-500">
                            {formatTime(inLog.timestamp)} → {outLog ? formatTime(outLog.timestamp) : "Active"}
                          </p>
                          {breakMs > 0 && (
                            <p className={`text-[11px] ${paidBreaks ? "text-emerald-400/80" : "text-amber-400/80"}`}>
                              ☕ {Math.round(breakMs / 60000)}m break {paidBreaks ? "(paid)" : "deducted"}
                            </p>
                          )}
                          {inLog.timezone && (
                            <p className="text-[10px] text-zinc-700">{inLog.timezone}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {dur !== null ? (
                            <span className="text-sm font-mono font-semibold text-white">
                              {formatDuration(dur)}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-400 animate-pulse">Active</span>
                          )}
                          <button
                            onClick={() => {
                              setCorrectionForm({ log_id: inLog.id, reason: "", proposed_time: "" });
                              setShowCorrection(true);
                            }}
                            className="w-7 h-7 rounded-lg hover:bg-zinc-700 flex items-center justify-center transition"
                            title="Request correction"
                          >
                            <Edit3 size={12} className="text-zinc-600 hover:text-zinc-300" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Correction requests */}
              {corrections.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Correction Requests</p>
                  <div className="space-y-2">
                    {corrections.map((c) => (
                      <div key={c.id}
                        className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl
                                   border border-zinc-800 bg-zinc-800/30"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm text-white">{c.reason}</p>
                          {c.proposed_time && (
                            <p className="text-xs text-zinc-500">Proposed: {formatDateTime(c.proposed_time)}</p>
                          )}
                          {c.manager_note && (
                            <p className="text-xs text-indigo-400">Manager: {c.manager_note}</p>
                          )}
                          <p className="text-[10px] text-zinc-600">{formatDateTime(c.requested_at)}</p>
                        </div>
                        {(() => {
                          const isMgr = currentUser?.role === "admin" || currentUser?.role === "manager";
                          const isOwn = c.employee_id === currentUser?.id;
                          // Managers get approve/decline on pending items that aren't their own.
                          if (isMgr && !isOwn && c.status === "pending") {
                            return (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => handleResolveCorrection(c, "approved")}
                                  disabled={processingId === c.id}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04211E] text-[11px] font-semibold transition disabled:opacity-50">
                                  {processingId === c.id ? "…" : "Approve"}
                                </button>
                                <button
                                  onClick={() => {
                                    const note = window.prompt("Reason for declining (optional):") ?? "";
                                    handleResolveCorrection(c, "rejected", note);
                                  }}
                                  disabled={processingId === c.id}
                                  className="px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px] transition disabled:opacity-50">
                                  Decline
                                </button>
                              </div>
                            );
                          }
                          return (
                            <span className={`text-[10px] px-2 py-1 rounded-full border flex-shrink-0 font-semibold
                              ${c.status === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                                c.status === "rejected" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                                "bg-amber-500/15 text-amber-400 border-amber-500/25"
                              }`}>
                              {c.status}
                            </span>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ADD SCHEDULE MODAL ── */}
      {showAddSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Add Schedule</h3>
              <button onClick={() => setShowAddSchedule(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                <X size={14} className="text-zinc-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Title</label>
                <input
                  value={newSchedule.title}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                <input
                  type="date"
                  value={newSchedule.date}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, date: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Start Time</label>
                  <input
                    type="time"
                    value={newSchedule.start_time}
                    onChange={(e) => setNewSchedule((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                               text-sm text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">End Time</label>
                  <input
                    type="time"
                    value={newSchedule.end_time}
                    onChange={(e) => setNewSchedule((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                               text-sm text-white outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Timezone</label>
                <input
                  value={newSchedule.timezone}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, timezone: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Repeat</label>
                <select
                  value={newSchedule.repeat}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, repeat: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {SCHEDULE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewSchedule((p) => ({ ...p, color: c }))}
                      className={`w-7 h-7 rounded-full transition border-2
                        ${newSchedule.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowAddSchedule(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSchedule}
                disabled={savingSchedule}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                           text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {savingSchedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CORRECTION MODAL ── */}
      {showCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Request Timesheet Correction</h3>
              <button onClick={() => setShowCorrection(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                <X size={14} className="text-zinc-400" />
              </button>
            </div>

            <div className="space-y-3">
              {correctionForm.log_id && (
                <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-xs text-indigo-400">Correction for entry: {correctionForm.log_id.slice(0, 8)}...</p>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Reason *</label>
                <textarea
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3}
                  placeholder="Describe what needs to be corrected..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white placeholder-zinc-600 outline-none
                             focus:border-indigo-500 transition resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Proposed Correct Time (optional)</label>
                <input
                  type="datetime-local"
                  value={correctionForm.proposed_time}
                  onChange={(e) => setCorrectionForm((p) => ({ ...p, proposed_time: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCorrection(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCorrection}
                disabled={submittingCorrection || !correctionForm.reason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                           bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                           transition disabled:opacity-50"
              >
                <Send size={13} />
                {submittingCorrection ? "Sending..." : "Send to Manager"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
// ── Geo tagging helper ────────────────────────────────────────────────────────
async function getGeoLocation(): Promise<{latitude:number;longitude:number;address:string}|null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude,longitude} = pos.coords;
        let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const d = await r.json();
          if (d.display_name) address = d.display_name.split(",").slice(0,3).join(",").trim();
        } catch {}
        resolve({ latitude, longitude, address });
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
export default function ClockingPage() {
  const { tenantId } = useTenant();
  return (
    <FeatureGate tenantId={tenantId} feature="clocking" title="Clocking">
      <ClockingPageInner />
    </FeatureGate>
  );
}