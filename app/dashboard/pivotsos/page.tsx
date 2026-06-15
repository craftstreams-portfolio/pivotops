"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import {
  Siren, AlertTriangle, ShieldAlert, CheckCircle2,
  Clock, ChevronRight, Plus, X, Loader2,
  Radio, TrendingUp, Users, Brain,
  AlertCircle, Activity, Zap, RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
type Severity   = "critical" | "high" | "medium" | "low";
type IncStatus  = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED" | "FAILED";

interface Incident {
  id:            string;
  tenant_id:     string;
  title:         string;
  description:   string | null;
  severity:      Severity;
  status:        IncStatus;
  category:      string | null;
  affected_area: string | null;
  reporter_name: string | null;
  assigned_to:   string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  escalated_to:  string | null;
  escalated_at:  string | null;
  sla_deadline:  string | null;
  sla_breached:  boolean;
  auto_healed:   boolean;
  resolved_at:   string | null;
  created_at:    string;
  updated_at:    string;
  priority:      number;
}

interface IncidentUpdate {
  id:          string;
  incident_id: string;
  message:     string;
  author:      string;
  type:        string;
  created_at:  string;
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const SEVERITY_CONFIG: Record<Severity, {
  label: string; cls: string; bg: string; dot: string; icon: React.ElementType;
}> = {
  critical: { label: "Critical", cls: "text-red-400",    bg: "bg-red-500/10 border-red-500/25",     dot: "bg-red-500",    icon: ShieldAlert    },
  high:     { label: "High",     cls: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25",dot: "bg-orange-500", icon: AlertTriangle  },
  medium:   { label: "Medium",   cls: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/25",  dot: "bg-amber-500",  icon: AlertCircle    },
  low:      { label: "Low",      cls: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/25",    dot: "bg-blue-500",   icon: Activity       },
};

const STATUS_CONFIG: Record<IncStatus, { label: string; cls: string }> = {
  OPEN:         { label: "Open",         cls: "bg-red-500/15 text-red-400 border-red-500/25"         },
  ACKNOWLEDGED: { label: "Acknowledged", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25"   },
  IN_PROGRESS:  { label: "In Progress",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/25"      },
  ESCALATED:    { label: "Escalated",    cls: "bg-purple-500/15 text-purple-400 border-purple-500/25"},
  RESOLVED:     { label: "Resolved",     cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"},
  CLOSED:       { label: "Closed",       cls: "bg-zinc-700/50 text-zinc-500 border-zinc-700"         },
  FAILED:       { label: "Failed",       cls: "bg-red-900/30 text-red-300 border-red-800/50"         },
};

const NEXT_STATES: Partial<Record<IncStatus, IncStatus[]>> = {
  OPEN:         ["ACKNOWLEDGED", "ESCALATED"],
  ACKNOWLEDGED: ["IN_PROGRESS",  "ESCALATED"],
  IN_PROGRESS:  ["RESOLVED",     "ESCALATED"],
  ESCALATED:    ["IN_PROGRESS",  "RESOLVED"],
  RESOLVED:     ["CLOSED"],
};

const CATEGORIES = [
  "System Failure", "Security Breach", "Compliance Violation",
  "Staffing Emergency", "Data Loss", "Service Outage",
  "HR Incident", "Safety Alert", "Other",
];

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? JSON.stringify(e);
}

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

// ─────────────────────────────────────────
// SLA TIMER
// ─────────────────────────────────────────
function SLATimer({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const calc = () => setRemaining(Math.max(0, new Date(deadline).getTime() - Date.now()));
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return <span className="text-zinc-600 text-[10px]">No SLA</span>;

  const breached = remaining === 0;
  const mins     = Math.floor(remaining / 60000);
  const secs     = Math.floor((remaining % 60000) / 1000);

  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono font-semibold
      ${breached ? "text-red-400" : mins < 5 ? "text-orange-400" : "text-emerald-400"}`}>
      <Clock size={9} />
      {breached ? "SLA BREACHED" : `${mins}m ${String(secs).padStart(2,"0")}s`}
    </span>
  );
}

// ─────────────────────────────────────────
// CREATE INCIDENT MODAL
// ─────────────────────────────────────────
function CreateIncidentModal({
  tenantId, currentUser, onClose, onCreated,
}: {
  tenantId:    string;
  currentUser: { id: string; full_name: string | null; email: string | null } | null;
  onClose:     () => void;
  onCreated:   () => void;
}) {
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [severity,     setSeverity]     = useState<Severity>("medium");
  const [category,     setCategory]     = useState(CATEGORIES[0]);
  const [affectedArea, setAffectedArea] = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const handleCreate = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError("");

    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:       "create",
          tenantId,
          title:        title.trim(),
          description:  description.trim() || undefined,
          severity,
          category,
          affectedArea: affectedArea.trim() || undefined,
          reporterId:   currentUser?.id,
          reporterName: currentUser?.full_name ?? currentUser?.email ?? "Unknown",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onCreated();
      onClose();
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-zinc-800 bg-[#0a0a14] p-6 space-y-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Siren size={16} className="text-red-400" />
            <h2 className="text-base font-semibold text-white">Declare Incident</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Severity selector */}
        <div>
          <label className="text-xs text-zinc-500 mb-2 block">Severity *</label>
          <div className="grid grid-cols-4 gap-2">
            {(["critical","high","medium","low"] as Severity[]).map((s) => {
              const cfg = SEVERITY_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <button key={s} onClick={() => setSeverity(s)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition
                    ${severity === s ? `${cfg.bg} ${cfg.cls}` : "border-zinc-800 text-zinc-600 hover:border-zinc-700"}`}>
                  <Icon size={14} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5">
            SLA: Critical=5min · High=15min · Medium=60min · Low=4hrs
          </p>
        </div>

        {[
          { label: "Title *",        value: title,        setter: setTitle,        placeholder: "Brief description of the incident" },
          { label: "Affected Area",  value: affectedArea, setter: setAffectedArea, placeholder: "e.g. Recruitment, Compliance, HR" },
        ].map(({ label, value, setter, placeholder }) => (
          <div key={label}>
            <label className="text-xs text-zinc-500 mb-1.5 block">{label}</label>
            <input value={value} onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                         text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition" />
          </div>
        ))}

        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                       text-sm text-white outline-none focus:border-zinc-600 cursor-pointer">
            {CATEGORIES.map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? What is the impact? What has been done so far?"
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                       text-sm text-white placeholder-zinc-600 outline-none
                       focus:border-zinc-600 transition resize-none" />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving || !title.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-red-600 hover:bg-red-500 text-white text-sm font-semibold
                       disabled:opacity-40 transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Siren size={14} />}
            {saving ? "Declaring..." : "Declare Incident"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// INCIDENT DETAIL PANEL
// ─────────────────────────────────────────
function IncidentPanel({
  incident, updates, currentUser, tenantId, onClose, onRefresh,
}: {
  incident:    Incident;
  updates:     IncidentUpdate[];
  currentUser: { id: string; full_name: string | null; email: string | null } | null;
  tenantId:    string;
  onClose:     () => void;
  onRefresh:   () => void;
}) {
  const [acting,    setActing]    = useState(false);
  const [updating,  setUpdating]  = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [error,     setError]     = useState("");

  const nextStates = NEXT_STATES[incident.status] ?? [];
  const cfg        = SEVERITY_CONFIG[incident.severity];
  const SevIcon    = cfg.icon;

  const handleTransition = async (nextState: IncStatus) => {
    setActing(true); setError("");
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:      nextState === "ACKNOWLEDGED" ? "acknowledge" : "transition",
          tenantId,
          incidentId:  incident.id,
          nextState,
          userId:      currentUser?.id,
          userName:    currentUser?.full_name ?? currentUser?.email ?? "Unknown",
          updatedBy:   currentUser?.full_name ?? currentUser?.email ?? "Unknown",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onRefresh();
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setActing(false);
    }
  };

  const handleEscalate = async () => {
    setActing(true); setError("");
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:      "escalate",
          tenantId,
          incidentId:  incident.id,
          severity:    incident.severity,
          escalatedBy: currentUser?.full_name ?? currentUser?.email ?? "Unknown",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onRefresh();
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setActing(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateMsg.trim()) return;
    setUpdating(true);
    await supabase.from("incident_updates").insert({
      incident_id: incident.id,
      tenant_id:   tenantId,
      message:     updateMsg.trim(),
      author:      currentUser?.full_name ?? currentUser?.email ?? "Unknown",
      author_id:   currentUser?.id ?? null,
      type:        "update",
      created_at:  new Date().toISOString(),
    });
    setUpdateMsg("");
    setUpdating(false);
    onRefresh();
  };

  // Run intelligence analysis
  const handleIntelligence = async () => {
    // Fetch from the existing intelligence route using incident id as event
    window.open(`/api/incidents/intelligence?eventId=${incident.id}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-[#0a0a14] border-l border-zinc-800 overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-[#0a0a14] z-10">
          <div className="flex items-center gap-2">
            <SevIcon size={16} className={cfg.cls} />
            <h2 className="text-sm font-semibold text-white">Incident Detail</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Title + badges */}
          <div>
            <h3 className="text-lg font-bold text-white leading-snug">{incident.title}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${cfg.bg} ${cfg.cls}`}>
                {cfg.label}
              </span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${STATUS_CONFIG[incident.status].cls}`}>
                {STATUS_CONFIG[incident.status].label}
              </span>
              {incident.category && (
                <span className="text-[11px] px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400">
                  {incident.category}
                </span>
              )}
            </div>
          </div>

          {/* SLA */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900">
            <span className="text-xs text-zinc-500">SLA Countdown</span>
            <SLATimer deadline={incident.sla_deadline} />
          </div>

          {/* Description */}
          {incident.description && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500 mb-1">Description</p>
              <p className="text-sm text-white/80 leading-relaxed">{incident.description}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Reporter",      incident.reporter_name ?? "—"],
              ["Assigned to",   incident.assigned_to   ?? "Unassigned"],
              ["Affected Area", incident.affected_area  ?? "—"],
              ["Escalated to",  incident.escalated_to   ?? "—"],
              ["Created",       timeAgo(incident.created_at)],
              ["Priority",      `P${incident.priority}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2">
                <p className="text-zinc-600 text-[10px] uppercase tracking-wider">{label}</p>
                <p className="text-white font-medium mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Action buttons */}
          {nextStates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-medium">Actions</p>
              <div className="flex flex-wrap gap-2">
                {nextStates.map((state) => (
                  <button key={state} onClick={() => handleTransition(state)} disabled={acting}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition disabled:opacity-40
                      ${state === "RESOLVED" || state === "CLOSED"
                        ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600"}`}>
                    {acting ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                    {STATUS_CONFIG[state].label}
                  </button>
                ))}

                {incident.status !== "ESCALATED" && incident.status !== "RESOLVED" && incident.status !== "CLOSED" && (
                  <button onClick={handleEscalate} disabled={acting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border
                               bg-purple-600/20 border-purple-500/30 text-purple-400
                               hover:bg-purple-600/30 text-xs font-semibold transition disabled:opacity-40">
                    <ShieldAlert size={12} /> Escalate
                  </button>
                )}

                <button onClick={handleIntelligence}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border
                             bg-indigo-600/20 border-indigo-500/30 text-indigo-400
                             hover:bg-indigo-600/30 text-xs font-semibold transition">
                  <Brain size={12} /> AI Analysis
                </button>
              </div>
            </div>
          )}

          {/* Add update */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium">Post Update</p>
            <div className="flex gap-2">
              <input value={updateMsg} onChange={(e) => setUpdateMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddUpdate(); }}
                placeholder="Add an update to this incident..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2
                           text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition" />
              <button onClick={handleAddUpdate} disabled={updating || !updateMsg.trim()}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400
                           disabled:opacity-40 transition text-sm">
                {updating ? <Loader2 size={14} className="animate-spin" /> : "Post"}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium">Timeline</p>
            {updates.length === 0 ? (
              <p className="text-xs text-zinc-700">No updates yet.</p>
            ) : (
              <div className="space-y-2">
                {[...updates].reverse().map((u) => (
                  <div key={u.id} className={`flex gap-3 px-3 py-2.5 rounded-xl border
                    ${u.type === "escalation" ? "border-purple-500/20 bg-purple-500/5" :
                      u.type === "resolution" ? "border-emerald-500/20 bg-emerald-500/5" :
                      u.type === "ack"        ? "border-amber-500/20 bg-amber-500/5"    :
                      u.type === "auto_heal"  ? "border-indigo-500/20 bg-indigo-500/5"  :
                                               "border-zinc-800 bg-zinc-900"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5
                      ${u.type === "escalation" ? "bg-purple-400" :
                        u.type === "resolution" ? "bg-emerald-400" :
                        u.type === "ack"        ? "bg-amber-400"   :
                        u.type === "auto_heal"  ? "bg-indigo-400"  : "bg-zinc-600"}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-white/80 leading-relaxed">{u.message}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {u.author} · {timeAgo(u.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// INCIDENT ROW
// ─────────────────────────────────────────
function IncidentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const cfg    = SEVERITY_CONFIG[incident.severity];
  const stCfg  = STATUS_CONFIG[incident.status];
  const SevIcon = cfg.icon;
  const isActive = !["RESOLVED","CLOSED","FAILED"].includes(incident.status);

  return (
    <div onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl border cursor-pointer
                  transition hover:border-zinc-600 group
        ${incident.severity === "critical" && isActive
          ? "border-red-500/25 bg-red-500/[0.03]"
          : "border-zinc-800 bg-zinc-900"}`}>

      {/* Severity dot + icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <SevIcon size={18} className={cfg.cls} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white truncate">{incident.title}</p>
          {incident.auto_healed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">Auto-healed</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${stCfg.cls}`}>
            {stCfg.label}
          </span>
          {incident.category && (
            <span className="text-[10px] text-zinc-600">{incident.category}</span>
          )}
          {incident.assigned_to && (
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Users size={9} /> {incident.assigned_to}
            </span>
          )}
          <span className="text-[10px] text-zinc-600">{timeAgo(incident.created_at)}</span>
        </div>
      </div>

      {/* SLA */}
      <div className="flex-shrink-0 text-right">
        {isActive && <SLATimer deadline={incident.sla_deadline} />}
        {!isActive && incident.resolved_at && (
          <span className="text-[10px] text-zinc-600">
            Resolved {timeAgo(incident.resolved_at)}
          </span>
        )}
        <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-500 mt-1 ml-auto transition" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function PivotSOSPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [incidents,    setIncidents]    = useState<Incident[]>([]);
  const [updates,      setUpdates]      = useState<IncidentUpdate[]>([]);
  const [currentUser,  setCurrentUser]  = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [selected,     setSelected]     = useState<Incident | null>(null);
  const [filter,       setFilter]       = useState<"all"|"active"|"resolved">("all");
  const [sevFilter,    setSevFilter]    = useState<Severity | "all">("all");
  const [streamActive, setStreamActive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getCurrentProfile().then((p) => { if (p) setCurrentUser(p); });
  }, []);

  const load = useCallback(async () => {
    if (tenantLoading) return;

    const { data: incData } = await supabase
      .from("incidents").select("*")
      .eq("tenant_id", tenantId)
      .order("priority",   { ascending: true })
      .order("created_at", { ascending: false });

    const { data: updData } = await supabase
      .from("incident_updates").select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    // Enrich with live SLA
    const enriched = (incData ?? []).map((inc: any) => ({
      ...inc,
      sla_breached: inc.sla_deadline
        ? Date.now() > new Date(inc.sla_deadline).getTime()
        : false,
    }));

    setIncidents(enriched as Incident[]);
    setUpdates((updData ?? []) as IncidentUpdate[]);
    setLoading(false);
  }, [tenantId, tenantLoading]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (tenantLoading) return;
    const ch = supabase.channel("sos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" },       () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_updates"}, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, tenantLoading, load]);

  // SSE stream
  const toggleStream = () => {
    if (streamActive) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setStreamActive(false);
    } else {
      const es = new EventSource("/api/incidents/stream");
      es.onmessage = () => load();
      eventSourceRef.current = es;
      setStreamActive(true);
    }
  };

  // Derived
  const filtered = incidents.filter((inc) => {
    const isActive   = !["RESOLVED","CLOSED","FAILED"].includes(inc.status);
    const matchState = filter === "all" ? true : filter === "active" ? isActive : !isActive;
    const matchSev   = sevFilter === "all" || inc.severity === sevFilter;
    return matchState && matchSev;
  });

  const activeCount    = incidents.filter((i) => !["RESOLVED","CLOSED","FAILED"].includes(i.status)).length;
  const criticalCount  = incidents.filter((i) => i.severity === "critical" && !["RESOLVED","CLOSED"].includes(i.status)).length;
  const breachedCount  = incidents.filter((i) => i.sla_breached && !["RESOLVED","CLOSED"].includes(i.status)).length;
  const resolvedToday  = incidents.filter((i) => i.resolved_at && new Date(i.resolved_at).toDateString() === new Date().toDateString()).length;

  const selectedUpdates = updates.filter((u) => u.incident_id === selected?.id);

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading PivotSOS...
      </div>
    );
  }

  return (
    <>
      {showCreate && (
        <CreateIncidentModal
          tenantId={tenantId} currentUser={currentUser}
          onClose={() => setShowCreate(false)}
          onCreated={() => { load(); setShowCreate(false); }}
        />
      )}

      {selected && (
        <IncidentPanel
          incident={selected}
          updates={selectedUpdates}
          currentUser={currentUser}
          tenantId={tenantId}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); }}
        />
      )}

      <div className="p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Siren size={22} className={criticalCount > 0 ? "text-red-400" : "text-zinc-400"} />
                PivotSOS
              </h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Command Center · Incident Management · Recovery Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* SSE stream toggle */}
            <button onClick={toggleStream}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition
                ${streamActive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700"}`}>
              <Radio size={13} className={streamActive ? "animate-pulse" : ""} />
              {streamActive ? "Live" : "Stream"}
            </button>

            <button onClick={load}
              className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900
                         hover:border-zinc-700 flex items-center justify-center transition">
              <RefreshCw size={14} className="text-zinc-400" />
            </button>

            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600
                         hover:bg-red-500 text-white text-sm font-semibold transition">
              <Plus size={15} /> Declare Incident
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active",    value: activeCount,   color: activeCount > 0 ? "text-red-400" : "text-white",     icon: Activity     },
            { label: "Critical",  value: criticalCount, color: criticalCount > 0 ? "text-red-400" : "text-zinc-500", icon: ShieldAlert  },
            { label: "SLA Breached", value: breachedCount, color: breachedCount > 0 ? "text-orange-400" : "text-zinc-500", icon: Clock },
            { label: "Resolved Today", value: resolvedToday, color: "text-emerald-400",                              icon: CheckCircle2 },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-1">
                <Icon size={14} className={`${color} opacity-70`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* System health banner */}
        {criticalCount === 0 && activeCount === 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-400 font-medium">All systems operational — No active incidents</p>
          </div>
        ) : criticalCount > 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 animate-pulse">
            <Siren size={15} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400 font-semibold">
              {criticalCount} CRITICAL incident{criticalCount > 1 ? "s" : ""} active — Immediate response required
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-400">{activeCount} active incident{activeCount > 1 ? "s" : ""} — Monitoring</p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all","active","resolved"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition
                ${filter === f ? "bg-white/10 text-white border border-white/20" : "text-zinc-500 hover:text-zinc-300"}`}>
              {f}
            </button>
          ))}
          <div className="w-px bg-zinc-800" />
          {(["all","critical","high","medium","low"] as const).map((s) => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition
                ${sevFilter === s
                  ? s === "all" ? "bg-white/10 text-white border border-white/20"
                    : `${SEVERITY_CONFIG[s as Severity]?.bg ?? ""} ${SEVERITY_CONFIG[s as Severity]?.cls ?? ""} border`
                  : "text-zinc-500 hover:text-zinc-300"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Incident list */}
        {filtered.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">
            {filter === "all" && sevFilter === "all"
              ? "No incidents. System is healthy."
              : "No incidents match your filters."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((inc) => (
              <IncidentRow key={inc.id} incident={inc} onClick={() => setSelected(inc)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}