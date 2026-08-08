"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import { useTenant } from "@/lib/hooks/useTenant";
import {
  UserMinus, CheckCircle2, AlertCircle,
  Plus, X, Calendar, FileText,
  ShieldOff, Package, Clock, Loader2,
} from "lucide-react";

type OffboardingStatus = "initiated" | "in_progress" | "completed" | "cancelled";

interface OffboardingRecord {
  id:              string;
  name:            string | null;
  email:           string | null;
  department:      string | null;
  reason:          string | null;
  last_day:        string | null;
  status:          OffboardingStatus;
  exit_interview:  boolean;
  assets_returned: boolean;
  access_revoked:  boolean;
  notes:           string | null;
  tenant_id:       string | null;
  created_at:      string;
}

const STATUS_STYLES: Record<OffboardingStatus, string> = {
  initiated:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  completed:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  cancelled:   "bg-red-500/15 text-red-400 border-red-500/20",
};

const REASONS = [
  "Resignation",
  "Redundancy",
  "End of Contract",
  "Retirement",
  "Termination",
  "Role Elimination",
  "Other",
];

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

interface Toast { id: string; type: "success" | "error"; message: string; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl
          border text-sm shadow-lg
          ${t.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/15 border-red-500/30 text-red-300"}`}>
          {t.type === "success"
            ? <CheckCircle2 size={15} className="flex-shrink-0" />
            : <AlertCircle  size={15} className="flex-shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function OffboardingPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [records,    setRecords]    = useState<OffboardingRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toasts,     setToasts]     = useState<Toast[]>([]);

  // Form state
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [department, setDepartment] = useState("");
  const [reason,     setReason]     = useState("Resignation");
  const [lastDay,    setLastDay]    = useState("");
  const [notes,      setNotes]      = useState("");

  const showToast = (type: "success" | "error", message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // ── Load ──────────────────────────────────
  const load = async () => {
    if (tenantLoading) return;
    const { data, error } = await supabase
      .from("offboarding")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load offboarding:", extractMessage(error));
      return;
    }
    setRecords((data ?? []) as OffboardingRecord[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId, tenantLoading]);

  // ── Realtime ─────────────────────────────
  useEffect(() => {
    if (tenantLoading) return;
    const channel = supabase
      .channel("offboarding-live")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "offboarding" },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, tenantLoading]);

  // ── Create offboarding ────────────────────
  const handleCreate = async () => {
    if (!name.trim())    { showToast("error", "Employee name is required"); return; }
    if (!email.trim())   { showToast("error", "Email is required");         return; }
    if (!isValidEmail(email)) { showToast("error", "Please enter a valid email address."); return; }
    if (!lastDay)        { showToast("error", "Last day is required");      return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("offboarding")
        .insert({
          name:            name.trim(),
          email:           email.trim(),
          department:      department.trim() || null,
          reason,
          last_day:        lastDay,
          notes:           notes.trim() || null,
          status:          "initiated",
          exit_interview:  false,
          assets_returned: false,
          access_revoked:  false,
          tenant_id:       tenantId,
        });

      if (error) throw new Error(extractMessage(error));

      showToast("success", `Offboarding initiated for ${name}`);
      setShowModal(false);
      resetForm();
      await load();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Update checklist item ─────────────────
  const handleChecklistToggle = async (
    record: OffboardingRecord,
    field: "exit_interview" | "assets_returned" | "access_revoked"
  ) => {
    const next = { ...record, [field]: !record[field] };

    // Auto-progress status
    const allDone = next.exit_interview && next.assets_returned && next.access_revoked;
    const anyDone = next.exit_interview || next.assets_returned || next.access_revoked;
    const newStatus: OffboardingStatus =
      allDone ? "completed" :
      anyDone ? "in_progress" : "initiated";

    setUpdatingId(record.id);
    try {
      const { error } = await supabase
        .from("offboarding")
        .update({
          [field]:    !record[field],
          status:     newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      if (error) throw new Error(extractMessage(error));

      setRecords((prev) =>
        prev.map((r) => r.id === record.id
          ? { ...r, [field]: !record[field], status: newStatus }
          : r
        )
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Cancel offboarding ────────────────────
  const handleCancel = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("offboarding")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw new Error(extractMessage(error));
      setRecords((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: "cancelled" } : r)
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const resetForm = () => {
    setName(""); setEmail(""); setDepartment("");
    setReason("Resignation"); setLastDay(""); setNotes("");
  };

  // Stats
  const initiated   = records.filter((r) => r.status === "initiated").length;
  const in_progress = records.filter((r) => r.status === "in_progress").length;
  const completed   = records.filter((r) => r.status === "completed").length;

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />
        Loading offboarding...
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Offboarding</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Manage employee exits — exit interviews, asset returns, access revocation.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/80
                       hover:bg-red-500 text-white text-sm font-semibold transition"
          >
            <Plus size={15} />
            Initiate Offboarding
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Initiated",    value: initiated,   color: "text-amber-400"   },
            { label: "In Progress",  value: in_progress, color: "text-blue-400"    },
            { label: "Completed",    value: completed,   color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Records */}
        {records.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-10
                          text-center text-sm text-zinc-600">
            No offboarding records yet. Initiate one above.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const isUpdating = updatingId === record.id;
              const progress   = [
                record.exit_interview,
                record.assets_returned,
                record.access_revoked,
              ].filter(Boolean).length;

              return (
                <div key={record.id}
                  className={`rounded-2xl border bg-zinc-900 p-5 transition
                    ${record.status === "completed"
                      ? "border-emerald-500/20 opacity-70"
                      : record.status === "cancelled"
                        ? "border-zinc-800 opacity-50"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserMinus size={15} className="text-red-400 flex-shrink-0" />
                        <h3 className="text-base font-semibold text-white">
                          {record.name ?? "—"}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-zinc-500">
                        {record.email && <span>{record.email}</span>}
                        {record.department && <span>· {record.department}</span>}
                        {record.reason && (
                          <span className="text-zinc-600">· {record.reason}</span>
                        )}
                      </div>
                      {record.last_day && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500">
                          <Calendar size={11} />
                          Last day: {new Date(record.last_day).toLocaleDateString([], {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border
                                       ${STATUS_STYLES[record.status]}`}>
                        {record.status.replace("_", " ")}
                      </span>
                      {record.status !== "completed" && record.status !== "cancelled" && (
                        <button
                          onClick={() => handleCancel(record.id)}
                          disabled={isUpdating}
                          className="text-xs text-zinc-600 hover:text-red-400 transition
                                     disabled:opacity-40"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                      <span>Offboarding checklist</span>
                      <span>{progress}/3 complete</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500
                          ${progress === 3 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${(progress / 3) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist */}
                  {record.status !== "cancelled" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          field:  "exit_interview" as const,
                          label:  "Exit Interview",
                          icon:   FileText,
                          done:   record.exit_interview,
                        },
                        {
                          field:  "assets_returned" as const,
                          label:  "Assets Returned",
                          icon:   Package,
                          done:   record.assets_returned,
                        },
                        {
                          field:  "access_revoked" as const,
                          label:  "Access Revoked",
                          icon:   ShieldOff,
                          done:   record.access_revoked,
                        },
                      ].map(({ field, label, icon: Icon, done }) => (
                        <button
                          key={field}
                          onClick={() => handleChecklistToggle(record, field)}
                          disabled={isUpdating || record.status === "completed"}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl
                                     border text-xs font-medium transition-colors
                                     disabled:cursor-not-allowed
                            ${done
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                          <Icon size={13} className="flex-shrink-0" />
                          {label}
                          {done && <CheckCircle2 size={12} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {record.notes && (
                    <p className="mt-3 text-xs text-zinc-600 border-t border-zinc-800 pt-3">
                      Note: {record.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
                     bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) { setShowModal(false); resetForm(); }
          }}
        >
          <div className="w-full max-w-md mx-4 rounded-2xl border border-zinc-800
                          bg-[#0f0f1a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Initiate Offboarding</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="text-zinc-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {[
              { label: "Employee Name *", value: name, set: setName, placeholder: "John Doe" },
              { label: "Email *", value: email, set: setEmail, placeholder: "john@company.com" },
              { label: "Department", value: department, set: setDepartment, placeholder: "Engineering" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-xs text-zinc-500 mb-1.5">{label}</label>
                <input value={value} onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                             text-sm text-white placeholder-zinc-600 outline-none
                             focus:border-zinc-600 transition" />
              </div>
            ))}

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Reason for Leaving</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                           text-sm text-white outline-none focus:border-zinc-600 cursor-pointer">
                {REASONS.map((r) => (
                  <option key={r} value={r} className="bg-zinc-900">{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Last Day *</label>
              <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                           text-sm text-white outline-none focus:border-zinc-600 transition" />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                           text-sm text-white placeholder-zinc-600 outline-none
                           focus:border-zinc-600 transition resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm
                           text-zinc-400 hover:text-white transition">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500
                           text-white text-sm font-semibold disabled:opacity-50 transition">
                {saving ? "Initiating..." : "Initiate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}