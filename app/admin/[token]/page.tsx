"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  Shield, Users, Building2, CreditCard, Trash2,
  RefreshCw, LogIn, Eye, AlertTriangle, CheckCircle2,
  Loader2, X, Search, ChevronDown, ChevronUp,
} from "lucide-react";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Tenant {
  id:         string;
  org_name:   string;
  apply_link: string | null;
  created_at: string;
}

interface Profile {
  id:         string;
  full_name:  string | null;
  email:      string | null;
  tenant_id:  string;
  role:       string | null;
  created_at: string;
}

interface Subscription {
  tenant_id:   string;
  plan:        string;
  status:      string;
  billing_cycle: string;
  current_period_end: string | null;
}

export default function SuperAdminPage() {
  const params    = useParams();
  const router    = useRouter();
  const token     = params?.token as string;

  const [auth,          setAuth]          = useState<"checking"|"ok"|"denied">("checking");
  const [tenants,       setTenants]       = useState<Tenant[]>([]);
  const [profiles,      setProfiles]      = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [action,        setAction]        = useState("");
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/admin/verify?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setAuth("ok");
          loadData();
        } else {
          setAuth("denied");
          setTimeout(() => router.push("/"), 2000);
        }
      })
      .catch(() => setAuth("denied"));
  }, [token]);

  // ── Load all data ───────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, profilesRes, subsRes] = await Promise.all([
        fetch(`/api/admin/data?token=${token}&table=tenants`),
        fetch(`/api/admin/data?token=${token}&table=profiles`),
        fetch(`/api/admin/data?token=${token}&table=subscriptions`),
      ]);
      const [t, p, s] = await Promise.all([
        tenantsRes.json(), profilesRes.json(), subsRes.json(),
      ]);
      setTenants(t.data  ?? []);
      setProfiles(p.data ?? []);
      setSubscriptions(s.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  const deleteTenant = async (tenantId: string, orgName: string) => {
    if (!confirm(`DELETE "${orgName}" and all associated data? This cannot be undone.`)) return;
    setAction(`Deleting ${orgName}...`);
    const res = await fetch(`/api/admin/delete-tenant?token=${token}&tenantId=${tenantId}`, { method: "DELETE" });
    const d   = await res.json();
    setAction(d.ok ? `✅ Deleted ${orgName}` : `❌ Failed: ${d.error}`);
    setTimeout(() => setAction(""), 3000);
    loadData();
  };

  const overridePlan = async (tenantId: string, plan: string) => {
    setAction(`Setting ${tenantId} to ${plan}...`);
    const res = await fetch(`/api/admin/override-plan?token=${token}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tenantId, plan }),
    });
    const d = await res.json();
    setAction(d.ok ? `✅ Plan updated to ${plan}` : `❌ ${d.error}`);
    setTimeout(() => setAction(""), 3000);
    loadData();
  };

  // ── Filtered tenants ────────────────────────────────────────────────────────
  const filtered = tenants.filter(t =>
    t.org_name.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  if (auth === "checking") return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-zinc-500" />
    </div>
  );

  if (auth === "denied") return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <AlertTriangle size={32} className="text-red-400 mx-auto" />
        <p className="text-white font-bold">Access Denied</p>
        <p className="text-zinc-500 text-sm">Redirecting...</p>
      </div>
    </div>
  );

  const subMap = Object.fromEntries(subscriptions.map(s => [s.tenant_id, s]));
  const profileMap: Record<string, Profile[]> = {};
  profiles.forEach(p => {
    if (!profileMap[p.tenant_id]) profileMap[p.tenant_id] = [];
    profileMap[p.tenant_id].push(p);
  });

  return (
    <div className="min-h-screen bg-[#080810] text-white">

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#080810]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Shield size={15} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">PivotOps Super Admin</p>
              <p className="text-[10px] text-red-400 font-mono">RESTRICTED ACCESS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {action && (
              <span className="text-xs text-zinc-400 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-700">
                {action}
              </span>
            )}
            <button onClick={loadData} className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition">
              <RefreshCw size={13} className="text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Tenants",       value: tenants.length,                                      icon: Building2,   color: "emerald" },
            { label: "Total Users",         value: profiles.length,                                     icon: Users,       color: "indigo"  },
            { label: "Active Paid",         value: subscriptions.filter(s => s.plan !== "free" && s.status === "active").length, icon: CreditCard, color: "amber" },
            { label: "Duplicate Orgs",      value: tenants.length - new Set(tenants.map(t => t.org_name)).size, icon: AlertTriangle, color: "red" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${
                color === "emerald" ? "bg-emerald-500/15" :
                color === "indigo"  ? "bg-indigo-500/15"  :
                color === "amber"   ? "bg-amber-500/15"   : "bg-red-500/15"
              }`}>
                <Icon size={15} className={
                  color === "emerald" ? "text-emerald-400" :
                  color === "indigo"  ? "text-indigo-400"  :
                  color === "amber"   ? "text-amber-400"   : "text-red-400"
                } />
              </div>
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tenants by name or ID..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition"
          />
        </div>

        {/* Tenants table */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Tenants ({filtered.length})</p>
            <p className="text-xs text-zinc-500">{profiles.length} total users across all tenants</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {filtered.map(tenant => {
                const sub      = subMap[tenant.id];
                const members  = profileMap[tenant.id] ?? [];
                const expanded = expandedTenant === tenant.id;

                return (
                  <div key={tenant.id}>
                    {/* Row */}
                    <div className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/40 transition">
                      <button onClick={() => setExpandedTenant(expanded ? null : tenant.id)}
                        className="flex-shrink-0 text-zinc-600 hover:text-white transition">
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{tenant.org_name}</p>
                        <p className="text-xs text-zinc-600 font-mono truncate">{tenant.id}</p>
                      </div>

                      <div className="hidden md:flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sub?.plan === "enterprise"   ? "bg-purple-500/20 text-purple-400" :
                          sub?.plan === "professional" ? "bg-indigo-500/20 text-indigo-400" :
                          sub?.plan === "starter"      ? "bg-emerald-500/20 text-emerald-400" :
                          "bg-zinc-800 text-zinc-500"
                        }`}>
                          {sub?.plan ?? "free"}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          sub?.status === "active"   ? "bg-emerald-500/10 text-emerald-400" :
                          sub?.status === "trialing" ? "bg-amber-500/10 text-amber-400"    :
                          "bg-red-500/10 text-red-400"
                        }`}>
                          {sub?.status ?? "no sub"}
                        </span>
                        <span className="text-xs text-zinc-600">{members.length} user{members.length !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <select
                          onChange={e => { if (e.target.value) overridePlan(tenant.id, e.target.value); e.target.value = ""; }}
                          className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg px-2 py-1 outline-none cursor-pointer"
                          defaultValue="">
                          <option value="" disabled>Set plan</option>
                          {["free","starter","professional","enterprise"].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteTenant(tenant.id, tenant.org_name)}
                          className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20
                                     flex items-center justify-center transition text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded members */}
                    {expanded && members.length > 0 && (
                      <div className="px-10 pb-4 space-y-2">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
                              {(m.full_name ?? m.email ?? "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{m.full_name ?? "No name"}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{m.email}</p>
                            </div>
                            <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">{m.role ?? "member"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}