"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import { Flag, Loader2, CheckCircle2, Filter } from "lucide-react";

interface Report {
  id: string;
  surface: string;
  ref_id: string | null;
  content_snapshot: string | null;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
}

const SURFACE_LABEL: Record<string, string> = {
  candidate_score:     "Candidate Assessment",
  xavier_insight:      "Xavier Intelligence",
  spotlight_breakdown: "Spotlight Breakdown",
  xavier_chat:         "Xavier Chat (public)",
};

const REASON_STYLE: Record<string, string> = {
  inaccurate: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  offensive:  "bg-red-500/15 text-red-400 border-red-500/25",
  misleading: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  other:      "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

export default function AIReportsPage() {
  const { tenantId, loading: tenantLoading } = useTenant();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "open" | "reviewed">("open");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let q = supabase
      .from("ai_content_reports")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setReports((data ?? []) as Report[]);
    setLoading(false);
  }, [tenantId, filter]);

  useEffect(() => { if (!tenantLoading) load(); }, [tenantLoading, load]);

  async function mark(id: string, status: string) {
    await supabase.from("ai_content_reports").update({ status }).eq("id", id);
    load();
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Flag size={20} className="text-amber-400" /> AI Content Reports
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Content flagged by your team as inaccurate, offensive or misleading. We use these to improve Xavier&apos;s output.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Filter size={13} className="text-zinc-600" />
        {(["open", "reviewed", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs capitalize transition border
              ${filter === f
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center">
          <CheckCircle2 size={22} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No {filter === "all" ? "" : filter} reports.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-white">
                  {SURFACE_LABEL[r.surface] ?? r.surface}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${REASON_STYLE[r.reason] ?? REASON_STYLE.other}`}>
                  {r.reason}
                </span>
                <span className="text-[10px] text-zinc-600 ml-auto">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>

              {r.content_snapshot && (
                <p className="text-xs text-zinc-500 leading-relaxed bg-zinc-950/60 rounded-lg px-3 py-2 border border-zinc-800/60">
                  {r.content_snapshot.slice(0, 400)}
                  {r.content_snapshot.length > 400 ? "..." : ""}
                </p>
              )}

              {r.note && (
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-600">Note: </span>{r.note}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                {r.status === "open" ? (
                  <>
                    <button onClick={() => mark(r.id, "reviewed")}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition">
                      Mark reviewed
                    </button>
                    <button onClick={() => mark(r.id, "dismissed")}
                      className="text-[11px] px-2.5 py-1 rounded-lg text-zinc-600 hover:text-zinc-400 transition">
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-600 capitalize">{r.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}