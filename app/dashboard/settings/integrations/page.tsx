"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Store, Plus, CheckCircle2, Loader2, ExternalLink } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Connection {
  handle: string;
  store_name: string | null;
  status: string;
  scope: string | null;
  installed_at: string;
  last_synced_at: string | null;
}

export default function IntegrationsPage() {
  const [handle, setHandle] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");

  async function authHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: "Bearer " + session.access_token } : {};
  }

  async function loadConnections() {
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/shopline/connections", { headers });
      const data = await res.json();
      if (res.ok) setConnections(data.connections ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    loadConnections();
    const params = new URLSearchParams(window.location.search);
    if (params.get("shopline") === "connected") {
      setTimeout(loadConnections, 800);
    }
  }, []);

  async function connect() {
    setError("");
    const clean = handle.trim().toLowerCase().replace(/\.myshopline\.com.*$/, "");
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(clean)) {
      setError("Enter a valid store handle, e.g. mystore");
      return;
    }
    setConnecting(true);
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/shopline/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({ handle: clean }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start connection.");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message ?? "Connection failed.");
      setConnecting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <Store className="w-6 h-6 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
      </div>
      <p className="text-zinc-400 text-sm mb-8">Connect your SHOPLINE store to PivotOps.</p>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Connect a SHOPLINE store</h2>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="yourstore"
              className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-600 outline-none"
              onKeyDown={(e) => e.key === "Enter" && connect()}
            />
            <span className="text-zinc-500 text-sm">.myshopline.com</span>
          </div>
          <button
            onClick={connect}
            disabled={connecting}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 font-bold px-5 py-3 rounded-xl text-sm transition flex items-center gap-2"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Connect
          </button>
        </div>
        {error ? <p className="text-red-400 text-sm mt-3">{error}</p> : null}
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Connected stores</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : connections.length === 0 ? (
          <p className="text-zinc-500 text-sm">No stores connected yet.</p>
        ) : (
          <ul className="space-y-3">
            {connections.map((c) => (
              <li key={c.handle} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{c.store_name || c.handle}</span>
                    {c.status === "active" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : null}
                  </div>
                  <span className="text-zinc-500 text-xs mt-0.5 block">{c.handle}.myshopline.com</span>
                </div>
                <span className={"text-xs px-2 py-1 rounded-md " + (c.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/40 text-zinc-400")}>{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}