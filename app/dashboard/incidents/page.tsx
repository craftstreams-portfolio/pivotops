"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import { FeatureGate } from "@/app/components/FeatureGate";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import {
  ShieldAlert, AlertTriangle, AlertCircle, Activity,
  Clock, CheckCircle2, Brain, ChevronRight,
  Loader2, X, RefreshCw, Search, Zap,
  BarChart3, TrendingUp, Users, FileText,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
type Severity  = "critical" | "high" | "medium" | "low";
type IncStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED" | "FAILED";

interface Incident {
  id:             string;
  tenant_id:      string;
  title:          string;
  description:    string | null;
  severity:       Severity;
  status:         IncStatus;
  category:       string | null;
  affected_area:  string | null;
  reporter_name:  string | null;
  assigned_to:    string | null;
  acknowledged_by:string | null;
  acknowledged_at:string | null;
  escalated_to:   string | null;
  escalated_at:   string | null;
  sla_deadline:   string | null;
  sla_breached:   boolean;
  auto_healed:    boolean;
  resolved_at:    string | null;
  created_at:     string;
  updated_at:     string;
  priority:       number;
}

interface IntelligenceResult {
  eventId:     string;
  graph:       any;
  score:       {
    severityScore:       number;
    impactScore:         number;
    rootCauseStrength:   number;
    criticalPathLength:  number;
    classification:      string;
    timeToFailureMs:     number;
  };
  recovery:    any;
  generatedAt: string;
}

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const SEVERITY_CONFIG: Record<Severity, {
  label: string; cls: string; bg: string; icon: React.ElementType;
}> = {
  critical: { label: "Critical", cls: "text-red-400",    bg: "bg-red-500/10 border-red-500/25",     icon: ShieldAlert   },
  high:     { label: "High",     cls: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25",icon: AlertTriangle },
  medium:   { label: "Medium",   cls: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/25",  icon: AlertCircle  },
  low:      { label: "Low",      cls: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/25",    icon: Activity     },
};

const STATUS_CONFIG: Record<IncStatus, { label: string; cls: string }> = {
  OPEN:         { label: "Open",         cls: "bg-red-500/15 text-red-400 border-red-500/25"          },
  ACKNOWLEDGED: { label: "Acknowledged", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25"    },
  IN_PROGRESS:  { label: "In Progress",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/25"       },
  ESCALATED:    { label: "Escalated",    cls: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  RESOLVED:     { label: "Resolved",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"},
  CLOSED:       { label: "Closed",       cls: "bg-zinc-700/50 text-zinc-500 border-zinc-700"          },
  FAILED:       { label: "Failed",       cls: "bg-red-900/30 text-red-300 border-red-800/50"          },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// SLA TIMER
// ─────────────────────────────────────────
function SLABadge({ deadline, breached }: { deadline: string | null; breached: boolean }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const calc = () => setRemaining(Math.max(0, new Date(deadline).getTime() - Date.now()));
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [deadline]);

  if (!deadline) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const isBreached = remaining === 0 || breached;

  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border
      ${isBreached
        ? "bg-red-500/15 border-red-500/25 text-red-400"
        : mins < 5
          ? "bg-orange-500/15 border-orange-500/25 text-orange-400"
          : "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"}`}>
      <Clock size={9} />
      {isBreached ? "BREACHED" : `${mins}m ${String(secs).padStart(2, "0")}s`}
    </span>
  );
}

// ─────────────────────────────────────────
// INTELLIGENCE PANEL
// ─────────────────────────────────────────
function IntelligencePanel({
  result, onClose,
}: {
  result:  IntelligenceResult;
  onClose: () => void;
}) {
  const score = result.score;
  const classColors: Record<string, string> = {
    critical: "text-red-400",
    high:     "text-orange-400",
    medium:   "text-amber-400",
    low:      "text-blue-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0a0a14] p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-indigo-400" />
            <h2 className="text-base font-semibold text-white">AI Intelligence Analysis</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Score overview */}
        <div className={`rounded-2xl border p-5 ${
          score.classification === "critical" ? "border-red-500/25 bg-red-500/5" :
          score.classification === "high"     ? "border-orange-500/25 bg-orange-500/5" :
          score.classification === "medium"   ? "border-amber-500/25 bg-amber-500/5" :
                                                "border-blue-500/25 bg-blue-500/5"
        }`}>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className={`text-5xl font-bold ${classColors[score.classification]}`}>
                {score.severityScore}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">Severity Score</p>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    score.severityScore >= 75 ? "bg-red-500" :
                    score.severityScore >= 50 ? "bg-orange-500" :
                    score.severityScore >= 25 ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${score.severityScore}%` }}
                />
              </div>
              <span className={`text-sm font-semibold capitalize ${classColors[score.classification]}`}>
                {score.classification} classification
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Impact Score",        value: `${Math.round(score.impactScore)}%`        },
              { label: "Root Cause Strength", value: `${Math.round(score.rootCauseStrength)}%`  },
              { label: "Critical Path",       value: `${score.criticalPathLength} steps`         },
              { label: "Time to Failure",     value: score.timeToFailureMs > 0 ? `${Math.round(score.timeToFailureMs / 1000)}s` : "N/A" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-black/20 px-3 py-2.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Graph stages */}
        {result.graph?.nodes?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Event Trace</p>
            <div className="space-y-1.5">
              {result.graph.nodes.slice(0, 10).map((node: any, i: number) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs
                  ${node.status === "failed"    ? "border-red-500/20 bg-red-500/5" :
                    node.status === "processed" ? "border-emerald-500/20 bg-emerald-500/5" :
                                                  "border-zinc-800 bg-zinc-900"}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0
                    ${node.status === "failed"    ? "bg-red-500" :
                      node.status === "processed" ? "bg-emerald-500" : "bg-zinc-600"}`} />
                  <span className="text-white font-medium flex-1">{node.stage}</span>
                  <span className="text-zinc-600">{node.type}</span>
                  <span className={`capitalize ${node.status === "failed" ? "text-red-400" : "text-zinc-500"}`}>
                    {node.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-recovery result */}
        {result.recovery && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={13} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400">Auto-Recovery Triggered</span>
            </div>
            <pre className="text-[11px] text-zinc-400 leading-relaxed overflow-x-auto">
              {JSON.stringify(result.recovery, null, 2)}
            </pre>
          </div>
        )}

        <p className="text-[11px] text-zinc-700">
          Analysis generated: {new Date(result.generatedAt).toLocaleString()}
        </p>

        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
function IncidentsPageInner() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [incidents,    setIncidents]    = useState<Incident[]>([]);
  const [currentUser,  setCurrentUser]  = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [sevFilter,    setSevFilter]    = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<IncStatus | "all">("all");
  const [intelligence, setIntelligence] = useState<IntelligenceResult | null>(null);
  const [analyzing,    setAnalyzing]    = useState<string | null>(null);
  const [actingId,     setActingId]     = useState<string | null>(null);

  useEffect(() => {
    getCurrentProfile().then((p) => { if (p) setCurrentUser(p); });
  }, []);

  const load = useCallback(async () => {
    if (tenantLoading) return;
    const { data } = await supabase
      .from("incidents").select("*")
      .eq("tenant_id", tenantId)
      .order("priority",   { ascending: true })
      .order("created_at", { ascending: false });

    const enriched = (data ?? []).map((inc: any) => ({
      ...inc,
      sla_breached: inc.sla_deadline
        ? Date.now() > new Date(inc.sla_deadline).getTime()
        : false,
    }));

    setIncidents(enriched as Incident[]);
    setLoading(false);
  }, [tenantId, tenantLoading]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (tenantLoading) return;
    const ch = supabase.channel("incidents-page-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, tenantLoading, load]);

  // Intelligence analysis
  const runAnalysis = async (incidentId: string) => {
    setAnalyzing(incidentId);
    try {
      const res  = await fetch(`/api/incidents/intelligence?eventId=${incidentId}`);
      const data = await res.json();
      if (data.success) setIntelligence(data);
    } catch (err) {
      console.error("Intelligence fetch failed:", extractMessage(err));
    } finally {
      setAnalyzing(null);
    }
  };

  // Quick action
  const quickAction = async (
    incidentId: string,
    action: string,
    extra?: Record<string, any>
  ) => {
    setActingId(incidentId);
    try {
      await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tenantId,
          incidentId,
          userId:    currentUser?.id,
          userName:  currentUser?.full_name ?? currentUser?.email ?? "Unknown",
          updatedBy: currentUser?.full_name ?? currentUser?.email ?? "Unknown",
          ...extra,
        }),
      });
      await load();
    } catch (err) {
      console.error("Action failed:", extractMessage(err));
    } finally {
      setActingId(null);
    }
  };

  // Filtered
  const visible = incidents.filter((inc) => {
    const matchSearch = !search ||
      inc.title.toLowerCase().includes(search.toLowerCase()) ||
      (inc.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (inc.affected_area ?? "").toLowerCase().includes(search.toLowerCase());
    const matchSev    = sevFilter    === "all" || inc.severity === sevFilter;
    const matchStatus = statusFilter === "all" || inc.status   === statusFilter;
    return matchSearch && matchSev && matchStatus;
  });

  // Stats
  const byStatus = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map((s) => [
      s, incidents.filter((i) => i.status === s).length,
    ])
  );
  const bySeverity = Object.fromEntries(
    (["critical","high","medium","low"] as Severity[]).map((s) => [
      s, incidents.filter((i) => i.severity === s).length,
    ])
  );
  const avgResolutionMs = (() => {
    const resolved = incidents.filter((i) => i.resolved_at);
    if (!resolved.length) return null;
    const avg = resolved.reduce((sum, i) =>
      sum + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()), 0
    ) / resolved.length;
    return Math.round(avg / 60000); // minutes
  })();

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading incidents...
      </div>
    );
  }

  return (
    <>
      {intelligence && (
        <IntelligencePanel result={intelligence} onClose={() => setIntelligence(null)} />
      )}

      <div className="p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText size={22} className="text-zinc-400" /> Incidents
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Full incident log · AI intelligence · state machine tracking
            </p>
          </div>
          <button onClick={load}
            className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900
                       hover:border-zinc-700 flex items-center justify-center transition">
            <RefreshCw size={14} className="text-zinc-400" />
          </button>
        </div>

        {/* Analytics strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total",     value: incidents.length, color: "text-white"       },
            { label: "Critical",  value: bySeverity.critical ?? 0, color: (bySeverity.critical ?? 0) > 0 ? "text-red-400" : "text-zinc-500" },
            { label: "Resolved",  value: (byStatus.RESOLVED ?? 0) + (byStatus.CLOSED ?? 0), color: "text-emerald-400" },
            { label: "Avg Resolution", value: avgResolutionMs ? `${avgResolutionMs}m` : "—", color: "text-blue-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Severity breakdown bar */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Severity Breakdown
          </p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-zinc-800">
            {(["critical","high","medium","low"] as Severity[]).map((s) => {
              const count = bySeverity[s] ?? 0;
              const pct   = incidents.length > 0 ? (count / incidents.length) * 100 : 0;
              const colors = { critical:"bg-red-500", high:"bg-orange-500", medium:"bg-amber-500", low:"bg-blue-500" };
              if (pct === 0) return null;
              return <div key={s} className={`${colors[s]} transition-all`} style={{ width: `${pct}%` }} />;
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {(["critical","high","medium","low"] as Severity[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${
                  s === "critical" ? "bg-red-500" : s === "high" ? "bg-orange-500" :
                  s === "medium"   ? "bg-amber-500" : "bg-blue-500"}`} />
                <span className="text-zinc-500 capitalize">{s} ({bySeverity[s] ?? 0})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <Search size={14} className="text-zinc-600 flex-shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents by title, category or area..."
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
            {search && <button onClick={() => setSearch("")} className="text-zinc-600 hover:text-zinc-400"><X size={14} /></button>}
          </div>

          <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer">
            <option value="all"      className="bg-zinc-900">All Severities</option>
            <option value="critical" className="bg-zinc-900">Critical</option>
            <option value="high"     className="bg-zinc-900">High</option>
            <option value="medium"   className="bg-zinc-900">Medium</option>
            <option value="low"      className="bg-zinc-900">Low</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer">
            <option value="all"         className="bg-zinc-900">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key} className="bg-zinc-900">{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Incident table */}
        {visible.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">
            {search || sevFilter !== "all" || statusFilter !== "all"
              ? "No incidents match your filters."
              : "No incidents recorded. System is healthy."}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Incident</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Severity</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">SLA</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Assigned</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inc) => {
                    const cfg    = SEVERITY_CONFIG[inc.severity];
                    const stCfg  = STATUS_CONFIG[inc.status];
                    const Icon   = cfg.icon;
                    const isActive = !["RESOLVED","CLOSED","FAILED"].includes(inc.status);

                    return (
                      <tr key={inc.id}
                        className="border-b border-zinc-800/60 hover:bg-zinc-900/50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2 min-w-0">
                            <Icon size={14} className={`${cfg.cls} flex-shrink-0 mt-0.5`} />
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate max-w-xs">{inc.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {inc.category && (
                                  <span className="text-[10px] text-zinc-600">{inc.category}</span>
                                )}
                                {inc.auto_healed && (
                                  <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                                    <Zap size={8} /> healed
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-700">{timeAgo(inc.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${cfg.bg} ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${stCfg.cls}`}>
                            {stCfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {isActive
                            ? <SLABadge deadline={inc.sla_deadline} breached={inc.sla_breached} />
                            : <span className="text-[10px] text-zinc-600">
                                {inc.resolved_at ? `Resolved ${timeAgo(inc.resolved_at)}` : "Closed"}
                              </span>
                          }
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs text-zinc-500">
                            {inc.assigned_to ?? "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Quick acknowledge */}
                            {inc.status === "OPEN" && (
                              <button
                                onClick={() => quickAction(inc.id, "acknowledge")}
                                disabled={actingId === inc.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border
                                           border-amber-500/25 bg-amber-500/10 text-amber-400
                                           text-[11px] hover:bg-amber-500/20 transition disabled:opacity-40">
                                {actingId === inc.id
                                  ? <Loader2 size={10} className="animate-spin" />
                                  : <CheckCircle2 size={11} />
                                }
                                Ack
                              </button>
                            )}

                            {/* Quick resolve */}
                            {["ACKNOWLEDGED","IN_PROGRESS","ESCALATED"].includes(inc.status) && (
                              <button
                                onClick={() => quickAction(inc.id, "transition", { nextState: "RESOLVED" })}
                                disabled={actingId === inc.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border
                                           border-emerald-500/25 bg-emerald-500/10 text-emerald-400
                                           text-[11px] hover:bg-emerald-500/20 transition disabled:opacity-40">
                                {actingId === inc.id
                                  ? <Loader2 size={10} className="animate-spin" />
                                  : <CheckCircle2 size={11} />
                                }
                                Resolve
                              </button>
                            )}

                            {/* AI Analysis */}
                            <button
                              onClick={() => runAnalysis(inc.id)}
                              disabled={analyzing === inc.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg border
                                         border-indigo-500/25 bg-indigo-500/10 text-indigo-400
                                         text-[11px] hover:bg-indigo-500/20 transition disabled:opacity-40">
                              {analyzing === inc.id
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Brain size={11} />
                              }
                              Analyse
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
export default function IncidentsPage() {
  const { tenantId } = useTenant();
  return (
    <FeatureGate tenantId={tenantId} feature="pivotsos" title="Incidents">
      <IncidentsPageInner />
    </FeatureGate>
  );
}