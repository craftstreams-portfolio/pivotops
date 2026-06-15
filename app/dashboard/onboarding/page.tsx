"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  updateOnboardingStatus,
  type OnboardingStatus,
} from "@/lib/onboarding/onboarding.engine";

const STATUSES: OnboardingStatus[] = [
  "pending",
  "documents",
  "training",
  "active",
  "completed",
];

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  pending:   "Pending",
  documents: "Documents",
  training:  "Training",
  active:    "Active",
  completed: "Completed",
  rejected:  "Rejected",
};

const STATUS_COLORS: Record<OnboardingStatus, string> = {
  pending:   "bg-zinc-500/15 text-zinc-400  border-zinc-500/20",
  documents: "bg-amber-500/15  text-amber-400  border-amber-500/20",
  training:  "bg-blue-500/15   text-blue-400   border-blue-500/20",
  active:    "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected:  "bg-red-500/15    text-red-400    border-red-500/20",
};

export default function OnboardingPage() {
  const [users,   setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // ── Load ──────────────────────────────
  const load = async () => {
    const { data, error } = await supabase
      .from("onboarding")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load onboarding users:", error.message ?? error);
      return;
    }

    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Realtime ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("onboarding-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding" },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Update status ─────────────────────
  const handleStatusChange = async (
    userId: string,
    newStatus: OnboardingStatus
  ) => {
    setUpdating(userId);
    try {
      await updateOnboardingStatus(supabase, userId, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Status update failed:", msg);
    } finally {
      setUpdating(null);
    }
  };

  const byStatus = (s: string) => users.filter((u) => u.status === s);

  // ── Completion stats ──────────────────
  const total     = users.length;
  const completed = users.filter((u) => u.status === "completed").length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Loading onboarding...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header + progress */}
      <div>
        <h1 className="text-2xl font-bold text-white">Onboarding</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Track new hires from pending through to active.
        </p>

        {total > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{completed} of {total} completed</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Board */}
      {total === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-zinc-600 text-sm">
          No onboarding profiles yet. Move a candidate to Review on the recruitment board to create one.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="flex-shrink-0 w-56 rounded-xl border border-white/[0.08] bg-[#0f0f1a] p-3 min-h-[420px]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold tracking-widest text-white/40 uppercase">
                  {STATUS_LABELS[status]}
                </h2>
                <span className="text-[10px] text-white/25 tabular-nums">
                  {byStatus(status).length}
                </span>
              </div>

              {/* Cards */}
              {byStatus(status).map((user) => (
                <div
                  key={user.id}
                  className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3"
                >
                  <p className="text-sm font-medium text-white truncate">
                    {user.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {user.email ?? "No email"}
                  </p>
                  {user.department && (
                    <p className="text-[10px] text-zinc-600 mt-1">
                      {user.department}
                    </p>
                  )}

                  {/* Status selector */}
                  <select
                    value={user.status}
                    disabled={updating === user.id}
                    onChange={(e) =>
                      handleStatusChange(user.id, e.target.value as OnboardingStatus)
                    }
                    className={`
                      mt-2 w-full text-[11px] px-2 py-1 rounded-lg border
                      bg-transparent cursor-pointer outline-none
                      disabled:opacity-40
                      ${STATUS_COLORS[user.status as OnboardingStatus] ?? "text-zinc-400"}
                    `}
                  >
                    {(Object.keys(STATUS_LABELS) as OnboardingStatus[]).map((s) => (
                      <option key={s} value={s} className="bg-zinc-900 text-white">
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {byStatus(status).length === 0 && (
                <div className="flex items-center justify-center h-16 rounded-lg
                                border border-dashed border-white/[0.05]
                                text-[11px] text-white/20">
                  Empty
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}