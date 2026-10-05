"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";

export default function WorkforcePage() {
  const { tenantId, loading: tenantLoading } = useTenant();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantLoading) return;
    supabase
      .from("clocking_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("timestamp", { ascending: false })
      .then(({ data }) => {
        setLogs(data || []);
        setLoading(false);
      });
  }, [tenantId, tenantLoading]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Workforce Activity</h1>
      <p className="text-zinc-400 mb-6">Live clocking logs and workforce movement.</p>

      {(loading || tenantLoading) && <p className="text-zinc-500">Loading...</p>}

      {!loading && !tenantLoading && logs.length === 0 && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No workforce activity yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border border-zinc-800 bg-zinc-900 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">User: {log.user_id}</p>
              <p className="text-zinc-500 text-xs mt-1">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
            <span className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${
              log.type === "CLOCK_IN"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}>
              {log.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}