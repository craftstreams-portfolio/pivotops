"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";

export default function SystemHealthPage() {
  const { tenantId, loading: tenantLoading } = useTenant();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantLoading) return;
    supabase
      .from("event_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs(data || []);
        setLoading(false);
      });
  }, [tenantId, tenantLoading]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">System Health</h1>
      <p className="text-zinc-400 mb-6">Real-time system status and diagnostics.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Total Events</p>
          <p className="text-2xl font-bold text-white">{logs.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">System Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-emerald-400 font-semibold">Operational</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs mb-1">Failed Events</p>
          <p className="text-2xl font-bold text-red-400">
            {logs.filter(l => l.status === "failed").length}
          </p>
        </div>
      </div>

      {(loading || tenantLoading) && <p className="text-zinc-500">Loading...</p>}

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border border-zinc-800 bg-zinc-900 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{log.type || log.event_type || "Event"}</p>
              <p className="text-zinc-500 text-xs mt-1">{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <span className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${
              log.status === "processed"
                ? "bg-emerald-500/10 text-emerald-400"
                : log.status === "failed"
                ? "bg-red-500/10 text-red-400"
                : "bg-zinc-700 text-zinc-400"
            }`}>
              {log.status || "unknown"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}