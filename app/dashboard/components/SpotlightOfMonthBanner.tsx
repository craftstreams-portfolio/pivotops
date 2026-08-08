"use client";

import { useEffect, useState } from "react";
import { supabase }            from "@/lib/supabase";
import { useTenant }           from "@/lib/hooks/useTenant";
import { Trophy, X, Sparkles } from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface SpotlightOfMonth {
  id:            string;
  tenant_id:     string;
  spotlight_id:  string;
  employee_name: string;
  avatar_url:    string | null;
  month:         string;
  approved_by:   string;
  created_at:    string;
}

// ─────────────────────────────────────────
// HELPER — is it the 1st of the month or later (and same month)
// ─────────────────────────────────────────
function isLive(monthStr: string): boolean {
  const now        = new Date();
  const monthDate  = new Date(monthStr);
  const isSameYear = now.getFullYear() === monthDate.getFullYear();
  const isSameMon  = now.getMonth()    === monthDate.getMonth();
  const isFirstOrLater = now.getDate() >= 1;
  return isSameYear && isSameMon && isFirstOrLater;
}

function getInitials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
    : p[0][0].toUpperCase();
}

// ─────────────────────────────────────────
// BANNER COMPONENT
// Displayed top-left on every employee dashboard
// ─────────────────────────────────────────
export default function SpotlightOfMonthBanner() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [spotlight, setSpotlight] = useState<SpotlightOfMonth | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded,  setExpanded]  = useState(false);

  useEffect(() => {
    if (tenantLoading) return;

    const load = async () => {
      const now         = new Date();
      const monthStart  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Get spotlight for current month
      const { data } = await supabase
        .from("spotlight_of_month")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("month", monthStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && isLive(data.month)) {
        setSpotlight(data as SpotlightOfMonth);
      }
    };

    load();

    // Realtime — shows immediately when reveal fires
    const channel = supabase.channel("sotm-banner")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "spotlight_of_month" },
        (payload) => {
          const row = payload.new as SpotlightOfMonth;
          if (row.tenant_id === tenantId && isLive(row.month)) {
            setSpotlight(row);
            setDismissed(false);
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, tenantLoading]);

  // Don't render if no spotlight, dismissed, or not live yet
  if (!spotlight || dismissed) return null;

  const monthLabel = new Date(spotlight.month).toLocaleString("en-US", {
    month: "long", year: "numeric",
  });

  // ── Collapsed pill (always visible top-left) ──────────
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed top-4 right-4 z-30 flex items-center gap-2.5
                   bg-gradient-to-r from-amber-500/20 to-orange-500/10
                   border border-amber-500/30 rounded-full pl-1 pr-4 py-1
                   shadow-lg shadow-amber-900/20 hover:border-amber-500/50 transition"
      >
        {/* Avatar */}
        <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-amber-500/50 flex-shrink-0">
          {spotlight.avatar_url ? (
            <img src={spotlight.avatar_url} alt={spotlight.employee_name}
              className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-indigo-500/30 flex items-center justify-center
                            text-indigo-200 text-xs font-bold">
              {getInitials(spotlight.employee_name)}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full
                          bg-amber-500 flex items-center justify-center">
            <Trophy size={8} className="text-black" />
          </div>
        </div>

        <div className="text-left">
          <p className="text-[10px] text-amber-400/70 leading-none">Spotlight · {monthLabel}</p>
          <p className="text-xs text-white font-semibold leading-tight mt-0.5">
            {spotlight.employee_name.split(" ")[0]}
          </p>
        </div>
      </button>
    );
  }

  // ── Expanded card ─────────────────────────────────────
  return (
    <div className="fixed top-4 right-4 z-30 w-72 rounded-2xl overflow-hidden shadow-2xl
                    shadow-amber-900/30 border border-amber-500/30">

      {/* Gradient header */}
      <div className="bg-gradient-to-br from-amber-600/30 via-orange-600/20 to-zinc-900 px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Trophy size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">
              Spotlight of the Month
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="text-zinc-500 hover:text-white transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/60">
              {spotlight.avatar_url ? (
                <img src={spotlight.avatar_url} alt={spotlight.employee_name}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-500/30 flex items-center justify-center
                                text-indigo-200 text-xl font-bold">
                  {getInitials(spotlight.employee_name)}
                </div>
              )}
            </div>
            {/* Crown badge */}
            <div className="absolute -top-1.5 -right-1.5 text-lg">👑</div>
          </div>

          <div>
            <p className="text-white font-bold text-base leading-tight">
              {spotlight.employee_name}
            </p>
            <p className="text-amber-400/70 text-[11px] mt-0.5">{monthLabel}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <Sparkles size={10} className="text-amber-400" />
              <span className="text-[10px] text-amber-400/80">Employee of the Month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-zinc-900 px-5 py-3 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">
          Approved by {spotlight.approved_by}
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}