"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, ShieldAlert, RefreshCcw, Workflow,
  Users, BarChart3, Settings, Activity, Bell, Search,
  Menu, X, Siren, Clock3, Trophy, Sparkles, Briefcase, Lock,
  ClipboardList, UserPlus, UserMinus, BadgeCheck, Flag,
  ChevronDown, ChevronRight, CalendarDays, Phone,
  Video, MessageSquare, LogOut, Plus,
} from "lucide-react";
import TeamInvitePanel from "@/app/dashboard/components/team/TeamInvitePanel";
import { useSubscription } from "@/lib/paddle/gate";
import DashboardTour from "@/app/dashboard/components/team/DashboardTour";
import { NotificationBell } from "@/lib/mentions/NotificationBell";
import XavierIntro from "@/app/dashboard/components/team/XavierIntro";

function PivotLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.866} viewBox="0 0 100 87" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sl-outer" x1="0" y1="0" x2="100" y2="87" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#d0d0d0" />
          <stop offset="35%"  stopColor="#ffffff" />
          <stop offset="65%"  stopColor="#909090" />
          <stop offset="100%" stopColor="#b8b8b8" />
        </linearGradient>
        <linearGradient id="sl-inner" x1="100" y1="0" x2="0" y2="87" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#606060" />
          <stop offset="50%"  stopColor="#c8c8c8" />
          <stop offset="100%" stopColor="#484848" />
        </linearGradient>
      </defs>
      <path d="M50 3L97 84H3L50 3Z" fill="rgba(255,255,255,0.02)" stroke="url(#sl-outer)" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M50 24L80 75H20L50 24Z" fill="none" stroke="url(#sl-inner)" strokeWidth="2.5" strokeLinejoin="round" strokeOpacity="0.55" />
    </svg>
  );
}

function AppLoadingScreen() {
  const [tick, setTick]     = useState(0);
  const steps = ["Establishing secure connection...","Loading your workspace...","Syncing workforce data...","Initialising Xavier AI...","Ready"];

  return (
    <div style={{ position:"fixed", inset:0, background:"#04060e", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:9999, fontFamily:"system-ui,sans-serif" }}>
      <div style={{ marginBottom:28 }}><PivotLogo size={72} /></div>
      <div style={{ textAlign:"center", marginBottom:44 }}>
        <div style={{ fontSize:20, fontWeight:600, color:"#fff" }}>PivotOps</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:"0.22em", textTransform:"uppercase", marginTop:5 }}>Autonomous Workforce OS</div>
      </div>
      <div style={{ width:180, height:1, background:"rgba(255,255,255,0.06)", borderRadius:1, overflow:"hidden", marginBottom:14 }}>
        <div style={{ height:"100%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)", animation:"barslide 1.6s ease-in-out infinite", width:"40%" }} />
      </div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.28)", fontFamily:"monospace" }}>
        {steps[tick]}<span style={{ animation:"blink 1s step-end infinite", marginLeft:2 }}>_</span>
      </div>
      <style>{`@keyframes barslide{0%{margin-left:-40%}100%{margin-left:140%}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}

type NavChild = { label:string; href:string; icon?:any };
type NavItem  = { label:string; href?:string; icon:any; children?:NavChild[] };

const GATED_HREFS: Record<string, "compliance" | "analytics" | "conference" | "clocking" | "tasks" | "showcase" | "spotlight" | "pivotsos" | "workflows"> = {
  "/dashboard/compliance":        "compliance",
  "/dashboard/analytics":         "analytics",
  "/dashboard/compliance-status": "compliance",
  "/dashboard/meetings":          "conference",
  "/dashboard/clocking":          "clocking",
  "/dashboard/tasks":             "tasks",
  "/dashboard/showcase":          "showcase",
  "/dashboard/spotlight":         "spotlight",
  "/dashboard/workflows":         "workflows",
  "/dashboard/pivotsos":          "pivotsos",
  "/dashboard/incidents":         "pivotsos",
  "/dashboard/recovery":          "pivotsos",
};

const navItems: NavItem[] = [
  { label:"Overview", href:"/dashboard", icon:LayoutDashboard },
  { label:"Workforce Operations", icon:Briefcase, children:[
    { label:"Recruitment",  href:"/dashboard/recruitment",  icon:UserPlus      },
    { label:"Onboarding",   href:"/dashboard/onboarding",   icon:UserPlus      },
    { label:"Offboarding",  href:"/dashboard/offboarding",  icon:UserMinus     },
    { label:"Compliance",   href:"/dashboard/compliance",   icon:BadgeCheck    },
    { label:"Task Center",  href:"/dashboard/tasks",        icon:ClipboardList },
    { label:"Clocking",     href:"/dashboard/clocking",     icon:Clock3        },
  ]},
  { label:"Pivot Teams", icon:Users, children:[
    { label:"Team Chat",         href:"/dashboard/teams",    icon:MessageSquare },
    { label:"Calendar",          href:"/dashboard/calendar", icon:CalendarDays  },
    { label:"Conference",        href:"/dashboard/meetings", icon:Video         },
    { label:"Huddles",           href:"/dashboard/voice",    icon:Phone         },
    { label:"Employee Profiles", href:"/dashboard/profiles", icon:UserPlus      },
  ]},
  { label:"PivotSOS", icon:Siren, children:[
    { label:"Command Center",  href:"/dashboard/pivotsos"                       },
    { label:"Incidents",       href:"/dashboard/incidents", icon:ShieldAlert    },
    { label:"Recovery Engine", href:"/dashboard/recovery",  icon:RefreshCcw     },
  ]},
  { label:"Analytics",     href:"/dashboard/analytics",  icon:BarChart3  },
  { label:"Workflows",     href:"/dashboard/workflows",  icon:Workflow   },
  { label:"Showcase",      href:"/dashboard/showcase",   icon:Trophy     },
  { label:"Spotlight",     href:"/dashboard/spotlight",  icon:Sparkles   },
  { label:"System Status", icon:Activity, children:[
    { label:"System Health",     href:"/dashboard/system"             },
    { label:"Audit Logs",        href:"/dashboard/audit"              },
    { label:"Compliance Status", href:"/dashboard/compliance-status", icon:BadgeCheck },
    { label:"AI Content Reports", href:"/dashboard/ai-reports", icon:Flag },
  ]},
  { label:"Settings", href:"/dashboard/settings", icon:Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [appReady,    setAppReady]    = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);
  const [userEmail,   setUserEmail]   = useState("");
  const [userInitial, setUserInitial] = useState("P");
  const [userId,      setUserId]      = useState("");
  const [notifCount,  setNotifCount]  = useState(0);
  const [openGroups,  setOpenGroups]  = useState<Record<string,boolean>>({
    "Workforce Operations": true,
    "Pivot Teams":          true,
    "PivotSOS":             true,
    "System Status":        true,
  });

  const [orgName,    setOrgName]    = useState("");
  const [userName,   setUserName]   = useState("");
  const [position,   setPosition]   = useState("");
  const [tenantId,   setTenantId]   = useState("");
  const sub = useSubscription(tenantId);

  // Helper: is a nav href locked for the current plan?
  const isLocked = (href?: string) => {
    if (!href) return false;
    const feat = GATED_HREFS[href];
    if (!feat) return false;
    return sub.features[feat] !== true;
  };
  const [orgSize,    setOrgSize]    = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const tourTargets = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      // Candidates belong in the candidate portal, not the owner dashboard.
      if (session.user.user_metadata?.role === "candidate") {
        router.replace("/candidate/portal");
        return;
      }
      const email = session.user.email ?? "";
      setUserEmail(email);
      setUserInitial((session.user.user_metadata?.full_name?.[0] ?? email[0] ?? "P").toUpperCase());
      setUserId(session.user.id);
      supabase.from("profiles").select("org_name, tenant_id, org_size, full_name, position").eq("id", session.user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setOrgName(data.org_name ?? "");
            setTenantId(data.tenant_id ?? "");
            setOrgSize(data.org_size ?? "");
            setUserName((data as any).full_name ?? "");
            setPosition((data as any).position ?? "");
            // Profiles created by the signup trigger don't carry org_name.
            // Fall back to the tenant's own name so invited users see it.
            if (data.tenant_id && !data.org_name) {
              supabase.from("tenants").select("org_name").eq("id", data.tenant_id).maybeSingle()
                .then(({ data: tnt }) => { if (tnt?.org_name) setOrgName(tnt.org_name); });
            }
            if (data.tenant_id) {
              supabase.from("xavier_notifications").select("id", { count:"exact" }).eq("read", false).eq("tenant_id", data.tenant_id)
                .then(({ count }) => setNotifCount(count ?? 0));
            }
          }
        });
      setTimeout(() => setAppReady(true), 900);
    });
  }, [router]);

  useEffect(() => { fetch("/api/start-worker", { method:"POST" }).catch(() => {}); }, []);

  const resolvedGroups = useMemo(() => {
    const next = { ...openGroups };
    for (const item of navItems) {
      if (!item.children) continue;
      if (item.children.some(c => pathname.startsWith(c.href))) next[item.label] = true;
    }
    return next;
  }, [pathname, openGroups]);

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setTimeout(() => { window.location.href = "/login"; }, 800);
    } catch { setLoggingOut(false); }
  }

  if (!appReady) return <AppLoadingScreen />;

  // 7-day free trial expired -> lock the entire dashboard behind an upgrade wall.
  // Only affects free/trialing tenants past their trial_ends_at; paid plans never hit this.
  if (!sub.loading && sub.isExpired) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-10">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6">
            <Lock size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Your free trial has ended</h1>
          <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
            Your 7-day PivotOps trial is over. Choose a plan to restore access to your workspace and all features.
          </p>
          <a href="/dashboard/settings/billing"
            className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-xl
                       bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                       text-white text-sm font-semibold transition">
            <Sparkles size={16} />
            Choose a plan
          </a>
          <p className="mt-5 text-xs text-zinc-600">
            Questions? <a href="/contact" className="text-indigo-400 hover:text-indigo-300">Contact us</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-zinc-950 text-white">

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed md:relative z-50 h-screen w-72 border-r border-zinc-800 bg-zinc-900 transition-transform duration-300 flex flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>

        {/* Fixed-height brand row. Every line below is height-bounded and the
            logo sits in a fixed box, so no combination of org name, job title or
            tagline can push the mark out of position on one account and not
            another — which is exactly what happened when a job title was set. */}
        <div className="flex h-20 items-center justify-between gap-3 border-b border-zinc-800 px-5 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 flex items-center justify-center"
                 style={{ width: 36, height: 36 }}>
              <PivotLogo size={34} />
            </div>

            <div className="min-w-0 flex-1 leading-none">
              <h1 className="text-[17px] font-semibold text-white tracking-tight leading-none truncate">
                PivotOps
              </h1>

              {/* The tagline gives way to the tenant name — showing both plus a
                  job title is what overflowed the row. */}
              {orgName ? (
                <div className="flex items-center gap-1.5 mt-[5px] min-w-0">
                  <p className="text-xs text-emerald-400 font-medium truncate leading-none">
                    {orgName}
                  </p>
                  <button
                    onClick={() => setShowInvite(true)}
                    title="Invite teammates"
                    className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 flex items-center justify-center transition"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-zinc-500 tracking-wider uppercase mt-[5px] leading-none truncate">
                  Autonomous Workforce OS
                </p>
              )}

              {position && (
                <p className="text-[10px] text-zinc-500 truncate leading-none mt-[5px]">
                  {position}
                </p>
              )}
            </div>
          </div>

          <button className="md:hidden flex-shrink-0 text-zinc-400 hover:text-white"
                  onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map(item => {
            const Icon = item.icon;
            if (item.children) {
              const expanded = resolvedGroups[item.label];
              const hasActiveChild = item.children.some(c => pathname.startsWith(c.href));
              return (
                <div key={item.label} className="space-y-1">
                  <button onClick={() => toggleGroup(item.label)}
                    ref={(el) => { tourTargets.current[`nav-${item.label}`] = el; }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 transition-colors ${hasActiveChild ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-transparent text-zinc-300 hover:bg-zinc-800"}`}>
                    <div className="flex items-center gap-3"><Icon size={16} /><span className="text-sm font-medium">{item.label}</span></div>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expanded && (
                    <div className="ml-4 space-y-0.5 border-l border-zinc-800 pl-4">
                      {item.children.map(child => {
                        const ChildIcon = child.icon;
                        const active = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link key={child.href} href={child.href} onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
                            {ChildIcon && <ChildIcon size={14} />}
                            <span>{child.label}</span>
                            {isLocked(child.href) && <Lock size={11} className="ml-auto text-zinc-600" />}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const active = pathname === item.href || pathname.startsWith((item.href ?? "") + "/");
            return (
              <Link key={item.href} href={item.href!} onClick={() => setMobileOpen(false)}
                ref={(el) => { tourTargets.current[`nav-${item.label}`] = el; }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${active ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-transparent text-zinc-400 hover:bg-zinc-800"}`}>
                <Icon size={16} /><span>{item.label}</span>
                {isLocked(item.href) && <Lock size={11} className="ml-auto text-zinc-600" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-3">
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-300">Xavier Analytics</span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between mb-1"><span className="text-zinc-400">Hiring Efficiency</span><span className="text-emerald-400">91%</span></div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full w-[91%] bg-emerald-400 rounded-full" /></div>
              </div>
              <div>
                <div className="flex justify-between mb-1"><span className="text-zinc-400">Automation Coverage</span><span className="text-indigo-400">84%</span></div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full w-[84%] bg-indigo-400 rounded-full" /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-semibold flex-shrink-0">{userInitial}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{userEmail || "PivotOps User"}</p>
              <p className="text-[10px] text-zinc-500">Workforce engine operational</p>
            </div>
            <button onClick={() => setShowLogoutConfirm(true)} disabled={loggingOut} title="Sign out"
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
              {loggingOut ? <div className="w-3.5 h-3.5 border border-zinc-500 border-t-transparent rounded-full animate-spin" /> : <LogOut size={15} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#080810]/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-zinc-400 hover:text-white" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="hidden md:flex w-72 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2">
              <Search size={14} className="text-zinc-500 flex-shrink-0" />
              <input className="w-full bg-transparent text-sm outline-none placeholder-zinc-600" placeholder="Search operations..." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={userId} tenantId={tenantId} />
            <button onClick={() => setShowLogoutConfirm(true)} disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/20 transition-colors disabled:opacity-40">
              {loggingOut ? <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" /> : <LogOut size={13} />}
              <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
            </button>
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-semibold">{userInitial}</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20
                              flex items-center justify-center mx-auto">
                <LogOut size={20} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Sign out of PivotOps?</h3>
              <p className="text-sm text-zinc-500">You will need to sign back in to access your workspace.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400
                           hover:text-white transition">
                Cancel
              </button>
              <button onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}
                disabled={loggingOut}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white
                           text-sm font-semibold transition disabled:opacity-50">
                {loggingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      <XavierIntro userName={userName} />

      <TeamInvitePanel
        open={showInvite}
        onClose={() => setShowInvite(false)}
        tenantId={tenantId}
        orgSize={orgSize}
      />
      <DashboardTour targets={tourTargets.current} />
    </div>
  );
}
