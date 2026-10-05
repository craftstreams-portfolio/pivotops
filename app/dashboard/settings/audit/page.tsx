"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ScrollText, Loader2, Filter } from "lucide-react";

/**
 * app/dashboard/settings/audit/page.tsx
 *
 * Unified audit trail. Events are written to three different tables -
 * application events, access control changes, and billing webhooks - which
 * meant the record existed but nobody could read it. This merges them into
 * one filterable timeline. Admin-only, enforced server-side.
 */

interface AuditRow {
  id: string;
  source: "application" | "access" | "billing";
  action: string;
  actor: string | null;
  entity: string | null;
  severity: "info" | "warning" | "critical";
  detail: Record<string, unknown>;
  ip: string | null;
  at: string;
}

const SEVERITY_STYLE: Record<AuditRow["severity"], { bg: string; text: string; label: string }> = {
  info:     { bg: "bg-zinc-700/30",   text: "text-zinc-400",    label: "Info" },
  warning:  { bg: "bg-amber-500/15",  text: "text-amber-400",   label: "Warning" },
  critical: { bg: "bg-red-500/15",    text: "text-red-400",     label: "Critical" },
};

const SOURCE_LABEL: Record<AuditRow["source"], string> = {
  application: "App",
  access:      "Access",
  billing:     "Billing",
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<"all" | AuditRow["source"]>("all");
  const [severity, setSeverity] = useState<"all" | AuditRow["severity"]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) { setError("Your session expired. Please sign in again."); setLoading(false); return; }

        const res = await fetch(`/api/audit?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(data.error ?? "Could not load the audit log."); setRows([]); }
        else setRows(data.rows ?? []);
      } catch {
        if (!cancelled) setError("Could not load the audit log.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [days]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (source !== "all" && r.source !== source) return false;
      if (severity !== "all" && r.severity !== severity) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        (r.actor ?? "").toLowerCase().includes(q) ||
        (r.entity ?? "").toLowerCase().includes(q) ||
        JSON.stringify(r.detail).toLowerCase().includes(q)
      );
    });
  }, [rows, source, severity, query]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <ScrollText className="w-6 h-6 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">Audit log</h1>
      </div>
      <p className="text-zinc-400 text-sm mb-6">
        Access changes, billing events, and significant actions across your workspace.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1.5 text-zinc-600 text-xs mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter
        </div>

        <select value={source} onChange={(e) => setSource(e.target.value as any)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          style={{ colorScheme: "dark" }}>
          <option value="all">All sources</option>
          <option value="application">App</option>
          <option value="access">Access</option>
          <option value="billing">Billing</option>
        </select>

        <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          style={{ colorScheme: "dark" }}>
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>

        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          style={{ colorScheme: "dark" }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>

        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actions, people, details…"
          className="flex-1 min-w-[180px] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-700" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-sm px-4 py-3">{error}</div>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm py-10 text-center">No events match these filters.</p>
      ) : (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          {filtered.map((r, i) => {
            const s = SEVERITY_STYLE[r.severity];
            const detailKeys = Object.keys(r.detail ?? {});
            return (
              <div key={`${r.source}-${r.id}-${i}`}
                   className={"px-4 py-3 flex items-start gap-3 " + (i % 2 ? "bg-zinc-900/30" : "")}>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5 ${s.bg} ${s.text}`}>
                  {s.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500 flex-shrink-0 mt-0.5">
                  {SOURCE_LABEL[r.source]}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-mono">{r.action}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {r.actor ? <>by <span className="text-zinc-400">{r.actor}</span></> : <span className="text-zinc-600">system</span>}
                    {r.entity ? <> · {r.entity}</> : null}
                    {r.ip ? <> · {r.ip}</> : null}
                  </p>
                  {detailKeys.length > 0 && (
                    <p className="text-[11px] text-zinc-600 mt-1 font-mono truncate">
                      {detailKeys.map((k) => `${k}: ${String((r.detail as any)[k])}`).join("  ·  ")}
                    </p>
                  )}
                </div>

                <span className="text-[11px] text-zinc-600 flex-shrink-0 mt-0.5 tabular-nums">
                  {new Date(r.at).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}