"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import {
  Zap, CheckCircle2, XCircle, Clock,
  Loader2, RefreshCw, Brain, Play,
  AlertTriangle, TrendingUp, RotateCcw,
  ShieldCheck, Activity, ChevronDown,
  ChevronUp, X, Plus,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface RecoveryPlan {
  id:          string;
  incident_id: string;
  tenant_id:   string;
  steps:       RecoveryStep[];
  status:      "pending" | "in_progress" | "completed" | "failed";
  created_by:  string | null;
  created_at:  string;
  updated_at:  string;
}

interface RecoveryStep {
  id:          string;
  label:       string;
  status:      "pending" | "in_progress" | "completed" | "failed";
  assignee?:   string;
  completedAt?: string;
  notes?:      string;
}

interface Incident {
  id:          string;
  title:       string;
  severity:    string;
  status:      string;
  auto_healed: boolean;
  created_at:  string;
}

interface HealResult {
  eventId: string;
  action:  string;
  reason?: string;
  success?: boolean;
}

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const STEP_TEMPLATES: Record<string, string[]> = {
  "System Failure":    ["Identify root cause", "Isolate affected components", "Apply fix", "Verify restoration", "Post-mortem"],
  "Security Breach":   ["Contain breach", "Revoke compromised credentials", "Audit access logs", "Patch vulnerability", "Notify affected parties"],
  "Compliance Violation": ["Document violation", "Notify compliance officer", "Suspend affected workflow", "Remediate", "Re-audit"],
  "Staffing Emergency":["Assess coverage gap", "Notify on-call staff", "Redistribute workload", "Document incident", "Review scheduling"],
  "Data Loss":         ["Assess scope of loss", "Activate backup restore", "Verify data integrity", "Notify affected users", "Root cause analysis"],
  "default":           ["Assess situation", "Contain impact", "Apply remediation", "Verify resolution", "Document findings"],
};

const STATUS_COLORS = {
  pending:     "text-zinc-500  bg-zinc-800       border-zinc-700",
  in_progress: "text-blue-400  bg-blue-500/10    border-blue-500/20",
  completed:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  failed:      "text-red-400   bg-red-500/10     border-red-500/20",
};

const STEP_ICONS = {
  pending:     Clock,
  in_progress: Activity,
  completed:   CheckCircle2,
  failed:      XCircle,
};

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
// RECOVERY PLAN CARD
// ─────────────────────────────────────────
function RecoveryPlanCard({
  plan, incident, currentUser, tenantId, onRefresh,
}: {
  plan:        RecoveryPlan;
  incident:    Incident | null;
  currentUser: { id: string; full_name: string | null; email: string | null } | null;
  tenantId:    string;
  onRefresh:   () => void;
}) {
  const [expanded,  setExpanded]  = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});
  const steps    = plan.steps ?? [];
  const done     = steps.filter((s) => s.status === "completed").length;
  const pct      = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;

  const updateStep = async (stepId: string, update: Partial<RecoveryStep>) => {
    setSaving(true);
    const newSteps = steps.map((s) =>
      s.id === stepId ? {
        ...s, ...update,
        completedAt: update.status === "completed" ? new Date().toISOString() : s.completedAt,
      } : s
    );

    const allDone   = newSteps.every((s) => s.status === "completed" || s.status === "failed");
    const anyFailed = newSteps.some((s) => s.status === "failed");
    const newStatus = allDone ? (anyFailed ? "failed" : "completed") :
                      newSteps.some((s) => s.status === "in_progress") ? "in_progress" : plan.status;

    await supabase.from("recovery_plans").update({
      steps:      newSteps,
      status:     newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", plan.id);

    // If recovery completed, update incident
    if (newStatus === "completed" && incident) {
      await supabase.from("incidents").update({
        status:      "RESOLVED",
        resolved_at: new Date().toISOString(),
        auto_healed: true,
        updated_at:  new Date().toISOString(),
      }).eq("id", incident.id);
    }

    onRefresh();
    setSaving(false);
  };

  const StatusIcon = STEP_ICONS[plan.status] ?? Clock;

  return (
    <div className={`rounded-2xl border overflow-hidden transition
      ${plan.status === "completed" ? "border-emerald-500/20" :
        plan.status === "failed"    ? "border-red-500/20"     :
        plan.status === "in_progress"? "border-blue-500/20"   : "border-zinc-800"}`}>

      {/* Header */}
      <div
        className={`flex items-center justify-between gap-3 px-5 py-4 cursor-pointer
          ${plan.status === "completed" ? "bg-emerald-500/5" :
            plan.status === "in_progress" ? "bg-blue-500/5"  : "bg-zinc-900"}`}
        onClick={() => setExpanded((o) => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${STATUS_COLORS[plan.status]}`}>
            <StatusIcon size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {incident?.title ?? `Recovery Plan`}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[plan.status]}`}>
                {plan.status.replace("_", " ")}
              </span>
              <span className="text-[10px] text-zinc-600">{done}/{steps.length} steps · {timeAgo(plan.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress */}
          <div className="hidden sm:block">
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-blue-500" : "bg-amber-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-0.5 text-right">{pct}%</p>
          </div>
          {expanded ? <ChevronUp size={15} className="text-zinc-600" /> : <ChevronDown size={15} className="text-zinc-600" />}
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-4 pt-2 bg-zinc-950/50 space-y-2">
          {steps.map((step, idx) => {
            const SIcon = STEP_ICONS[step.status] ?? Clock;
            return (
              <div key={step.id}
                className={`rounded-xl border px-4 py-3 transition
                  ${step.status === "completed" ? "border-emerald-500/15 bg-emerald-500/5" :
                    step.status === "in_progress"? "border-blue-500/15 bg-blue-500/5"      :
                    step.status === "failed"     ? "border-red-500/15 bg-red-500/5"        :
                                                   "border-zinc-800 bg-zinc-900"}`}>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-[11px] text-zinc-600 flex-shrink-0 mt-0.5 w-5 text-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${
                        step.status === "completed" ? "text-emerald-300 line-through" :
                        step.status === "failed"    ? "text-red-300" : "text-white"
                      }`}>
                        {step.label}
                      </p>
                      {step.assignee && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">→ {step.assignee}</p>
                      )}
                      {step.completedAt && (
                        <p className="text-[10px] text-emerald-400/60 mt-0.5">
                          Completed {timeAgo(step.completedAt)}
                        </p>
                      )}
                      {step.notes && (
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{step.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Step actions */}
                  {plan.status !== "completed" && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {step.status !== "in_progress" && step.status !== "completed" && (
                        <button
                          onClick={() => updateStep(step.id, { status: "in_progress" })}
                          disabled={saving}
                          className="text-[10px] px-2 py-1 rounded-lg border border-blue-500/20
                                     bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-40">
                          Start
                        </button>
                      )}
                      {step.status !== "completed" && (
                        <button
                          onClick={() => updateStep(step.id, { status: "completed", notes: noteInput[step.id] })}
                          disabled={saving}
                          className="text-[10px] px-2 py-1 rounded-lg border border-emerald-500/20
                                     bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-40">
                          <CheckCircle2 size={11} />
                        </button>
                      )}
                      {step.status !== "failed" && step.status !== "completed" && (
                        <button
                          onClick={() => updateStep(step.id, { status: "failed" })}
                          disabled={saving}
                          className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20
                                     bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-40">
                          <XCircle size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function RecoveryPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [plans,       setPlans]       = useState<RecoveryPlan[]>([]);
  const [incidents,   setIncidents]   = useState<Incident[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [healing,     setHealing]     = useState<string | null>(null);
  const [healResult,  setHealResult]  = useState<HealResult | null>(null);
  const [creating,    setCreating]    = useState(false);
  const [newIncId,    setNewIncId]    = useState("");
  const [newCategory, setNewCategory] = useState("default");
  const [error,       setError]       = useState("");

  useEffect(() => {
    getCurrentProfile().then((p) => { if (p) setCurrentUser(p); });
  }, []);

  const load = useCallback(async () => {
    if (tenantLoading) return;

    const [{ data: planData }, { data: incData }] = await Promise.all([
      supabase.from("recovery_plans").select("*").eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase.from("incidents").select("id,title,severity,status,auto_healed,created_at")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    ]);

    setPlans((planData ?? []) as RecoveryPlan[]);
    setIncidents((incData ?? []) as Incident[]);
    setLoading(false);
  }, [tenantId, tenantLoading]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (tenantLoading) return;
    const ch = supabase.channel("recovery-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "recovery_plans" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, tenantLoading, load]);

  // Auto-heal
  const runAutoHeal = async (incidentId: string) => {
    setHealing(incidentId);
    setHealResult(null);
    try {
      const res  = await fetch(`/api/incidents/intelligence?eventId=${incidentId}`);
      const data = await res.json();

      if (data.recovery) {
        setHealResult({ eventId: incidentId, action: "auto_heal", success: true });
        await supabase.from("incidents").update({
          auto_healed: true,
          updated_at:  new Date().toISOString(),
        }).eq("id", incidentId);
        await supabase.from("incident_updates").insert({
          incident_id: incidentId,
          tenant_id:   tenantId,
          message:     `Auto-heal triggered by Xavier AI. Recovery score: ${data.score?.severityScore ?? "N/A"}`,
          author:      "Xavier AI",
          type:        "auto_heal",
          created_at:  new Date().toISOString(),
        });
      } else {
        setHealResult({
          eventId: incidentId,
          action:  data.score?.action ?? "monitor",
          reason:  `Severity score: ${data.score?.severityScore ?? "—"}. Below auto-heal threshold.`,
        });
      }
      await load();
    } catch (err) {
      setHealResult({ eventId: incidentId, action: "failed", reason: extractMessage(err) });
    } finally {
      setHealing(null);
    }
  };

  // Create recovery plan
  const createPlan = async () => {
    if (!newIncId.trim()) { setError("Select an incident"); return; }
    setCreating(true); setError("");

    const templateKey = newCategory === "default" ? "default" : newCategory;
    const stepLabels  = STEP_TEMPLATES[templateKey] ?? STEP_TEMPLATES.default;
    const steps: RecoveryStep[] = stepLabels.map((label) => ({
      id:      crypto.randomUUID(),
      label,
      status:  "pending",
    }));

    const { error: err } = await supabase.from("recovery_plans").insert({
      incident_id: newIncId,
      tenant_id:   tenantId,
      steps,
      status:      "pending",
      created_by:  currentUser?.full_name ?? currentUser?.email ?? "Unknown",
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    });

    if (err) { setError(extractMessage(err)); }
    else { setNewIncId(""); await load(); }
    setCreating(false);
  };

  // Stats
  const completed   = plans.filter((p) => p.status === "completed").length;
  const inProgress  = plans.filter((p) => p.status === "in_progress").length;
  const autoHealed  = incidents.filter((i) => i.auto_healed).length;
  const activeIncs  = incidents.filter((i) => !["RESOLVED","CLOSED","FAILED"].includes(i.status));

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading recovery engine...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <RotateCcw size={22} className="text-indigo-400" /> Recovery Engine
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Auto-healing · Recovery plans · Incident restoration
          </p>
        </div>
        <button onClick={load}
          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900
                     hover:border-zinc-700 flex items-center justify-center transition">
          <RefreshCw size={14} className="text-zinc-400" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Recovery Plans",  value: plans.length,  color: "text-white"       },
          { label: "In Progress",     value: inProgress,    color: "text-blue-400"    },
          { label: "Completed",       value: completed,     color: "text-emerald-400" },
          { label: "Auto-Healed",     value: autoHealed,    color: "text-indigo-400"  },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Auto-heal panel */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Xavier AI Auto-Heal</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            Severity ≥ 75 triggers automatically
          </span>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Run intelligence analysis on an active incident. If severity score ≥ 75, auto-recovery
          is triggered. Otherwise, monitoring mode is activated.
        </p>

        {activeIncs.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-400">No active incidents — system is healthy</span>
          </div>
        ) : (
          <div className="space-y-2">
            {activeIncs.map((inc) => (
              <div key={inc.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                           border border-zinc-800 bg-zinc-900">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{inc.title}</p>
                  <p className="text-[10px] text-zinc-500">
                    {inc.severity.toUpperCase()} · {inc.status} · {timeAgo(inc.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inc.auto_healed && (
                    <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                      <Zap size={9} /> Healed
                    </span>
                  )}
                  <button
                    onClick={() => runAutoHeal(inc.id)}
                    disabled={healing === inc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border
                               border-indigo-500/25 bg-indigo-500/15 text-indigo-400
                               text-xs font-medium hover:bg-indigo-500/25 transition disabled:opacity-40">
                    {healing === inc.id
                      ? <><Loader2 size={12} className="animate-spin" /> Analysing...</>
                      : <><Zap size={12} /> Auto-Heal</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Heal result */}
        {healResult && (
          <div className={`mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border text-xs
            ${healResult.success
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-400"}`}>
            {healResult.success ? <Zap size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" /> :
              <Activity size={13} className="text-zinc-500 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">
                {healResult.success ? "Auto-heal successful" : `Action: ${healResult.action}`}
              </p>
              {healResult.reason && <p className="opacity-70 mt-0.5">{healResult.reason}</p>}
            </div>
            <button onClick={() => setHealResult(null)} className="ml-auto text-zinc-600 hover:text-zinc-400">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Create recovery plan */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Plus size={15} className="text-zinc-400" /> Create Recovery Plan
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={newIncId} onChange={(e) => setNewIncId(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                       text-sm text-white outline-none focus:border-zinc-600 cursor-pointer">
            <option value="" className="bg-zinc-900">Select incident...</option>
            {incidents.filter((i) => !["RESOLVED","CLOSED"].includes(i.status)).map((i) => (
              <option key={i.id} value={i.id} className="bg-zinc-900">
                [{i.severity.toUpperCase()}] {i.title}
              </option>
            ))}
          </select>

          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            className="sm:w-56 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                       text-sm text-white outline-none focus:border-zinc-600 cursor-pointer">
            <option value="default" className="bg-zinc-900">Default Template</option>
            {Object.keys(STEP_TEMPLATES).filter((k) => k !== "default").map((k) => (
              <option key={k} value={k} className="bg-zinc-900">{k}</option>
            ))}
          </select>

          <button onClick={createPlan} disabled={creating || !newIncId}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                       bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                       disabled:opacity-40 transition">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Create Plan
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}
      </div>

      {/* Recovery plans list */}
      {plans.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">
          No recovery plans yet. Create one above or trigger auto-heal on an active incident.
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Recovery Plans ({plans.length})
          </h2>
          {plans.map((plan) => (
            <RecoveryPlanCard
              key={plan.id}
              plan={plan}
              incident={incidents.find((i) => i.id === plan.incident_id) ?? null}
              currentUser={currentUser}
              tenantId={tenantId}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}