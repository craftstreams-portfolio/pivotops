"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Building2, Users, Globe, Briefcase, ChevronRight,
  CheckCircle2, Loader2, Brain, Zap, Shield, BarChart3,
  ArrowLeft, X, Plus, MapPin, Cpu,
} from "lucide-react";

// CONSTANTS
const INDUSTRIES = [
  "Healthcare & Staffing","Technology","Finance & Banking","Legal",
  "Logistics & Supply Chain","Retail & E-Commerce","Education",
  "Construction & Engineering","Media & Marketing","Consulting",
  "Manufacturing","Government & Public Sector","Other",
];
const TEAM_SIZES = [
  "1-5 (Solo / Micro)","6-20 (Small)","21-50 (Growing)",
  "51-200 (Mid-size)","201-500 (Scale-up)","500+ (Enterprise)",
];
const COUNTRIES = [
  "Nigeria","United Kingdom","United States","Ghana","Kenya",
  "South Africa","Canada","Australia","UAE","India","Other",
];
const DEPARTMENTS_DEFAULT = ["Recruitment","HR","Operations","Compliance","Finance","IT"];

// REMOTE WORKER SVG BACKGROUND
function RemoteWorkersBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="glow1" cx="25%" cy="60%" r="40%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow2" cx="75%" cy="40%" r="40%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#0d0d14" />
        </linearGradient>
        <filter id="blur2">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <rect width="1440" height="900" fill="#04060e" />
      <rect width="1440" height="900" fill="url(#glow1)" />
      <rect width="1440" height="900" fill="url(#glow2)" />

      {Array.from({ length: 20 }, (_, i) => (
        <line key={`v${i}`} x1={i * 76} y1="0" x2={i * 76} y2="900"
          stroke="#22c55e" strokeOpacity="0.03" strokeWidth="1" />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 75} x2="1440" y2={i * 75}
          stroke="#22c55e" strokeOpacity="0.03" strokeWidth="1" />
      ))}

      <g transform="translate(80, 120)">
        <rect x="0" y="200" width="260" height="12" rx="4" fill="url(#desk)" />
        <rect x="40" y="110" width="180" height="115" rx="8"
          fill="#111827" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="1.5" />
        <rect x="48" y="118" width="164" height="99" rx="4" fill="#0a1628" />
        <rect x="48" y="118" width="164" height="99" rx="4"
          fill="#22c55e" fillOpacity="0.04" />
        <rect x="60" y="133" width="80" height="5" rx="2" fill="#22c55e" fillOpacity="0.4" />
        <rect x="60" y="145" width="120" height="4" rx="2" fill="#22c55e" fillOpacity="0.2" />
        <rect x="60" y="155" width="100" height="4" rx="2" fill="#22c55e" fillOpacity="0.15" />
        <rect x="60" y="168" width="140" height="20" rx="4" fill="#22c55e" fillOpacity="0.08"
          stroke="#22c55e" strokeOpacity="0.2" strokeWidth="1" />
        <rect x="66" y="173" width="60" height="8" rx="2" fill="#22c55e" fillOpacity="0.3" />
        <circle cx="130" cy="113" r="3" fill="#22c55e" fillOpacity="0.6" />
        <rect x="117" y="225" width="26" height="8" rx="2" fill="#1a1a2e" />
        <rect x="100" y="230" width="60" height="6" rx="3" fill="#1a1a2e" />
        <rect x="60" y="215" width="140" height="18" rx="4" fill="#111827"
          stroke="#374151" strokeWidth="1" />
        <ellipse cx="130" cy="310" rx="40" ry="25" fill="#111827" />
        <circle cx="130" cy="280" r="22" fill="#1a1a2e" stroke="#374151" strokeWidth="1" />
        <circle cx="123" cy="276" r="3" fill="#4b5563" />
        <circle cx="137" cy="276" r="3" fill="#4b5563" />
        <path d="M 123 286 Q 130 291 137 286" stroke="#4b5563" strokeWidth="1.5"
          fill="none" strokeLinecap="round" />
        <path d="M 95 310 Q 80 290 85 275" stroke="#1a1a2e" strokeWidth="16"
          strokeLinecap="round" fill="none" />
        <path d="M 165 310 Q 180 290 175 275" stroke="#1a1a2e" strokeWidth="16"
          strokeLinecap="round" fill="none" />
        <circle cx="85" cy="275" r="5" fill="#1f2937" />
        <circle cx="175" cy="275" r="5" fill="#1f2937" />
        <rect x="95" y="320" width="70" height="20" rx="10"
          fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="1" />
        <text x="130" y="334" textAnchor="middle" fill="#22c55e" fillOpacity="0.7"
          fontSize="9" fontFamily="monospace">Remote</text>
      </g>

      <g transform="translate(1000, 80)">
        <rect x="0" y="200" width="260" height="12" rx="4" fill="url(#desk)" />
        <rect x="40" y="110" width="180" height="115" rx="8"
          fill="#111827" stroke="#22c55e" strokeOpacity="0.25" strokeWidth="1.5" />
        <rect x="48" y="118" width="164" height="99" rx="4" fill="#0a1628" />
        <rect x="56" y="124" width="72" height="42" rx="3" fill="#22c55e" fillOpacity="0.06"
          stroke="#22c55e" strokeOpacity="0.15" strokeWidth="1" />
        <rect x="136" y="124" width="68" height="42" rx="3" fill="#22c55e" fillOpacity="0.04"
          stroke="#22c55e" strokeOpacity="0.1" strokeWidth="1" />
        <text x="92" y="148" textAnchor="middle" fill="#22c55e" fillOpacity="0.5"
          fontSize="14" fontFamily="monospace" fontWeight="bold">98%</text>
        <rect x="60" y="175" width="140" height="4" rx="2" fill="#22c55e" fillOpacity="0.15" />
        <rect x="60" y="184" width="100" height="4" rx="2" fill="#22c55e" fillOpacity="0.1" />
        <rect x="60" y="193" width="120" height="4" rx="2" fill="#22c55e" fillOpacity="0.08" />
        <circle cx="130" cy="113" r="3" fill="#22c55e" fillOpacity="0.5" />
        <rect x="117" y="225" width="26" height="8" rx="2" fill="#1a1a2e" />
        <rect x="100" y="230" width="60" height="6" rx="3" fill="#1a1a2e" />
        <rect x="60" y="215" width="140" height="18" rx="4" fill="#111827"
          stroke="#374151" strokeWidth="1" />
        <ellipse cx="130" cy="310" rx="40" ry="25" fill="#111827" />
        <circle cx="130" cy="280" r="22" fill="#1a1a2e" stroke="#374151" strokeWidth="1" />
        <circle cx="123" cy="276" r="3" fill="#4b5563" />
        <circle cx="137" cy="276" r="3" fill="#4b5563" />
        <path d="M 123 287 Q 130 292 137 287" stroke="#4b5563" strokeWidth="1.5"
          fill="none" strokeLinecap="round" />
        <path d="M 95 310 Q 80 292 85 278" stroke="#1a1a2e" strokeWidth="16"
          strokeLinecap="round" fill="none" />
        <path d="M 165 310 Q 180 292 175 278" stroke="#1a1a2e" strokeWidth="16"
          strokeLinecap="round" fill="none" />
        <circle cx="85" cy="278" r="5" fill="#1f2937" />
        <circle cx="175" cy="278" r="5" fill="#1f2937" />
        <rect x="95" y="320" width="70" height="20" rx="10"
          fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="1" />
        <text x="130" y="334" textAnchor="middle" fill="#22c55e" fillOpacity="0.7"
          fontSize="9" fontFamily="monospace">Remote</text>
      </g>

      <g transform="translate(120, 490)">
        <rect x="0" y="200" width="230" height="10" rx="4" fill="url(#desk)" />
        <rect x="30" y="115" width="170" height="108" rx="8"
          fill="#111827" stroke="#22c55e" strokeOpacity="0.2" strokeWidth="1.5" />
        <rect x="38" y="122" width="154" height="93" rx="4" fill="#0a1628" />
        <rect x="44" y="128" width="100" height="14" rx="7" fill="#22c55e" fillOpacity="0.12" />
        <rect x="88" y="148" width="96" height="14" rx="7" fill="#374151" fillOpacity="0.6" />
        <rect x="44" y="167" width="80" height="14" rx="7" fill="#22c55e" fillOpacity="0.1" />
        <rect x="44" y="187" width="140" height="10" rx="4"
          fill="#22c55e" fillOpacity="0.05" stroke="#22c55e" strokeOpacity="0.15" strokeWidth="1" />
        <circle cx="115" cy="118" r="2.5" fill="#22c55e" fillOpacity="0.5" />
        <rect x="102" y="223" width="26" height="7" rx="2" fill="#1a1a2e" />
        <rect x="87" y="228" width="56" height="5" rx="2" fill="#1a1a2e" />
        <rect x="52" y="212" width="126" height="16" rx="4" fill="#111827"
          stroke="#374151" strokeWidth="1" />
        <ellipse cx="115" cy="298" rx="36" ry="22" fill="#111827" />
        <circle cx="115" cy="270" r="20" fill="#1a1a2e" stroke="#374151" strokeWidth="1" />
        <circle cx="109" cy="267" r="2.5" fill="#4b5563" />
        <circle cx="121" cy="267" r="2.5" fill="#4b5563" />
        <path d="M 109 277 Q 115 281 121 277" stroke="#4b5563" strokeWidth="1.5"
          fill="none" strokeLinecap="round" />
        <path d="M 82 298 Q 68 281 73 267" stroke="#1a1a2e" strokeWidth="14"
          strokeLinecap="round" fill="none" />
        <path d="M 148 298 Q 162 281 157 267" stroke="#1a1a2e" strokeWidth="14"
          strokeLinecap="round" fill="none" />
        <rect x="82" y="308" width="66" height="18" rx="9"
          fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="1" />
        <text x="115" y="321" textAnchor="middle" fill="#22c55e" fillOpacity="0.7"
          fontSize="9" fontFamily="monospace">Remote</text>
      </g>

      <g transform="translate(1040, 460)">
        <rect x="0" y="200" width="240" height="10" rx="4" fill="url(#desk)" />
        <rect x="35" y="110" width="170" height="112" rx="8"
          fill="#111827" stroke="#22c55e" strokeOpacity="0.25" strokeWidth="1.5" />
        <rect x="43" y="118" width="154" height="96" rx="4" fill="#0a1628" />
        <rect x="49" y="124" width="42" height="84" rx="3" fill="#22c55e" fillOpacity="0.05"
          stroke="#22c55e" strokeOpacity="0.12" strokeWidth="1" />
        <rect x="97" y="124" width="42" height="84" rx="3" fill="#22c55e" fillOpacity="0.04"
          stroke="#22c55e" strokeOpacity="0.1" strokeWidth="1" />
        <rect x="145" y="124" width="44" height="84" rx="3" fill="#22c55e" fillOpacity="0.03"
          stroke="#22c55e" strokeOpacity="0.08" strokeWidth="1" />
        <rect x="52" y="130" width="36" height="18" rx="3" fill="#22c55e" fillOpacity="0.15" />
        <rect x="52" y="153" width="36" height="18" rx="3" fill="#22c55e" fillOpacity="0.1" />
        <rect x="100" y="130" width="36" height="18" rx="3" fill="#374151" fillOpacity="0.5" />
        <rect x="148" y="130" width="38" height="18" rx="3" fill="#22c55e" fillOpacity="0.08" />
        <circle cx="120" cy="113" r="2.5" fill="#22c55e" fillOpacity="0.5" />
        <rect x="107" y="222" width="26" height="7" rx="2" fill="#1a1a2e" />
        <rect x="90" y="227" width="60" height="5" rx="2" fill="#1a1a2e" />
        <rect x="55" y="213" width="130" height="16" rx="4" fill="#111827"
          stroke="#374151" strokeWidth="1" />
        <ellipse cx="120" cy="302" rx="38" ry="23" fill="#111827" />
        <circle cx="120" cy="273" r="21" fill="#1a1a2e" stroke="#374151" strokeWidth="1" />
        <circle cx="113" cy="270" r="2.5" fill="#4b5563" />
        <circle cx="127" cy="270" r="2.5" fill="#4b5563" />
        <path d="M 113 280 Q 120 285 127 280" stroke="#4b5563" strokeWidth="1.5"
          fill="none" strokeLinecap="round" />
        <path d="M 86 302 Q 72 284 77 270" stroke="#1a1a2e" strokeWidth="15"
          strokeLinecap="round" fill="none" />
        <path d="M 154 302 Q 168 284 163 270" stroke="#1a1a2e" strokeWidth="15"
          strokeLinecap="round" fill="none" />
        <rect x="87" y="313" width="66" height="18" rx="9"
          fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="1" />
        <text x="120" y="326" textAnchor="middle" fill="#22c55e" fillOpacity="0.7"
          fontSize="9" fontFamily="monospace">Remote</text>
      </g>

      <line x1="340" y1="320" x2="550" y2="450" stroke="#22c55e" strokeOpacity="0.06"
        strokeWidth="1" strokeDasharray="6 4" />
      <line x1="1100" y1="300" x2="870" y2="450" stroke="#22c55e" strokeOpacity="0.06"
        strokeWidth="1" strokeDasharray="6 4" />
      <line x1="350" y1="650" x2="550" y2="550" stroke="#22c55e" strokeOpacity="0.05"
        strokeWidth="1" strokeDasharray="6 4" />
      <line x1="1040" y1="620" x2="880" y2="550" stroke="#22c55e" strokeOpacity="0.05"
        strokeWidth="1" strokeDasharray="6 4" />

      <circle cx="720" cy="450" r="200" fill="#22c55e" fillOpacity="0.02" />
      <circle cx="720" cy="450" r="120" fill="#22c55e" fillOpacity="0.02" />

      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="100%" stopColor="#04060e" stopOpacity="0.7" />
      </radialGradient>
      <rect width="1440" height="900" fill="url(#vignette)" />
    </svg>
  );
}

// QUESTION CARD - swipe animation wrapper
function QuestionCard({
  children,
  direction,
  animKey,
}: {
  children:  React.ReactNode;
  direction: "enter" | "exit-left" | "idle";
  animKey:   number;
}) {
  const style: React.CSSProperties =
    direction === "enter"
      ? { animation: "slideInRight 0.45s cubic-bezier(0.22,1,0.36,1) forwards" }
      : direction === "exit-left"
      ? { animation: "slideOutLeft 0.35s cubic-bezier(0.55,0,1,0.45) forwards" }
      : {};

  return (
    <div key={animKey} style={style}
      className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl
                 shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden">
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideOutLeft {
          from { transform: translateX(0);     opacity: 1; }
          to   { transform: translateX(-110%); opacity: 0; }
        }
      `}</style>
      {children}
    </div>
  );
}

// TOGGLE SWITCH
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
        ${value ? "bg-emerald-500" : "bg-zinc-700"}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow
                        transition-transform duration-200
        ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// MAIN PAGE
export default function OnboardingPage() {
  const router = useRouter();

  const [userId,    setUserId]    = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [saving,    setSaving]    = useState(false);

  const [orgName,     setOrgName]     = useState("");
  const [industry,    setIndustry]    = useState("");
  const [teamSize,    setTeamSize]    = useState("");
  const [country,     setCountry]     = useState("");
  const [adminName,   setAdminName]   = useState("");
  const [departments, setDepts]       = useState<string[]>(DEPARTMENTS_DEFAULT);
  const [newDept,     setNewDept]     = useState("");
  const [autoScore,   setAutoScore]   = useState(true);
  const [autoReject,  setAutoReject]  = useState(true);
  const [autoOnboard, setAutoOnboard] = useState(true);
  const [geoTag,      setGeoTag]      = useState(false);
  const [thresholdAI, setThresholdAI] = useState(75);
  const [thresholdMR, setThresholdMR] = useState(50);

  const [launched,  setLaunched]  = useState(false);
  const [applyLink, setApplyLink] = useState("");
  const [copied,    setCopied]    = useState(false);

  const [currentStep,  setCurrentStep]  = useState(0);
  const [animState,    setAnimState]    = useState<"enter" | "exit-left" | "idle">("enter");
  const [animKey,      setAnimKey]      = useState(0);
  const [isExiting,    setIsExiting]    = useState(false);

  const TOTAL_STEPS = 9;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? "");
      setAdminName(session.user.user_metadata?.full_name ?? "");
      supabase.from("profiles").select("onboarding_complete")
        .eq("id", session.user.id).single()
        .then(({ data }) => {
          if (data?.onboarding_complete) router.replace("/dashboard");
        });
    });
  }, [router]);

  const goNext = () => {
    if (isExiting) return;
    setIsExiting(true);
    setAnimState("exit-left");
    setTimeout(() => {
      setCurrentStep((s) => s + 1);
      setAnimState("enter");
      setAnimKey((k) => k + 1);
      setIsExiting(false);
    }, 350);
  };

  const goBack = () => {
    if (isExiting || currentStep === 0) return;
    setIsExiting(true);
    setAnimState("exit-left");
    setTimeout(() => {
      setCurrentStep((s) => s - 1);
      setAnimState("enter");
      setAnimKey((k) => k + 1);
      setIsExiting(false);
    }, 350);
  };

  const complete = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const tid = orgName.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) + "-" + Date.now().toString(36);

      const { error: tenantErr } = await supabase.from("tenants").upsert({
        id: tid, slug: tid, name: orgName.trim(), org_name: orgName.trim(), org_industry: industry,
        org_size: teamSize, org_country: country,
        owner_id: userId, owner_email: userEmail,
        created_at: now, updated_at: now,
      }, { onConflict: "id" });
      if (tenantErr) throw new Error("Tenant creation failed: " + tenantErr.message);

      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: userId, email: userEmail,
        full_name: adminName.trim() || userEmail.split("@")[0],
        tenant_id: tid, role: "admin",
        org_name: orgName.trim(), org_industry: industry,
        org_size: teamSize, org_country: country,
        onboarding_complete: true,
        first_login_at: now, date_joined: now.slice(0,10),
        updated_at: now,
      }, { onConflict: "id" });
      if (profileErr) throw new Error("Profile update failed: " + profileErr.message);

      await supabase.from("settings").upsert({
        tenant_id: tid, org_name: orgName.trim(),
        org_departments: departments,
        ai_enabled: autoScore, onboarding_automation: autoOnboard,
        geo_tagging_enabled: geoTag, updated_at: now,
      }, { onConflict: "tenant_id" });

      const { data: ex } = await supabase.from("score_thresholds")
        .select("id").eq("tenant_id", tid).is("manager_id", null).maybeSingle();
      if (!ex) {
        await supabase.from("score_thresholds").insert({
          tenant_id: tid, manager_id: null,
          auto_interview: thresholdAI, manual_review: thresholdMR,
        });
      }

      for (const ch of ["candidates","recruitment-review","general","teams-media"]) {
        const { data: ec } = await supabase.from("channels")
          .select("id").eq("name", ch).eq("tenant_id", tid).maybeSingle();
        if (!ec) {
          await supabase.from("channels").insert({
            name: ch, tenant_id: tid, type: "channel",
            created_by: userId, created_at: now,
          });
        }
      }

      await supabase.from("audit_logs").insert({
        tenant_id: tid, user_id: userId,
        action: "workspace_created", entity_type: "tenant", entity_id: tid,
        metadata: { org_name: orgName, industry, team_size: teamSize },
        created_at: now,
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      setApplyLink(`${baseUrl}/apply/${tid}`);
      setAnimState("exit-left");
      setTimeout(() => {
        setSaving(false);
        setLaunched(true);
      }, 400);
    } catch (err) {
      console.error("Onboarding failed:", err);
      alert(err instanceof Error ? err.message : "Onboarding failed. Check the browser console for details.");
      setSaving(false);
    }
  };

  const addDept = () => {
    if (newDept.trim() && !departments.includes(newDept.trim())) {
      setDepts([...departments, newDept.trim()]);
      setNewDept("");
    }
  };

  const copyApplyLink = async () => {
    try {
      await navigator.clipboard.writeText(applyLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied - link is still visible to copy manually
    }
  };

  const inputCls = "w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 transition";
  const labelCls = "block text-xs text-zinc-400 mb-1.5 font-medium uppercase tracking-wide";

  const canContinue = [
    true,
    !!orgName.trim(),
    !!industry,
    !!teamSize,
    !!country,
    !!adminName.trim(),
    departments.length > 0,
    thresholdAI > thresholdMR,
    true,
  ];

  const steps = [

    <div key={0} className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Zap size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Getting Started
          </p>
          <h2 className="text-xl font-bold text-white">Welcome to PivotOps</h2>
        </div>
      </div>
      <p className="text-zinc-400 text-sm leading-relaxed">
        You're about to set up your autonomous workforce OS. We'll ask you a few questions
        to configure your workspace - it takes under 2 minutes.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Brain,     label: "Xavier AI",       sub: "Auto-scoring & routing" },
          { icon: Shield,    label: "Compliance",       sub: "Credentialing & docs"   },
          { icon: Users,     label: "Team Management",  sub: "Clocking & scheduling"  },
          { icon: BarChart3, label: "Analytics",        sub: "Realtime insights"       },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-3">
            <Icon size={16} className="text-emerald-400 mb-1.5" />
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-[11px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>
    </div>,

    <div key={1} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Building2 size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Organisation
          </p>
          <h2 className="text-xl font-bold text-white">What's your organisation name?</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">This will be your workspace name across PivotOps.</p>
      <div>
        <label className={labelCls}>Organisation / Agency Name *</label>
        <input
          autoFocus
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && orgName.trim() && goNext()}
          placeholder="e.g. Apex Staffing Solutions"
          className={inputCls}
        />
      </div>
    </div>,

    <div key={2} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Briefcase size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Industry
          </p>
          <h2 className="text-xl font-bold text-white">What industry are you in?</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">
        This helps Xavier AI tune its scoring model for your sector.
      </p>
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {INDUSTRIES.map((ind) => (
          <button
            key={ind}
            onClick={() => { setIndustry(ind); }}
            className={`text-left px-3 py-2.5 rounded-xl border text-sm transition
              ${industry === ind
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-medium"
                : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
          >
            {industry === ind && <CheckCircle2 size={12} className="inline mr-1.5 mb-0.5" />}
            {ind}
          </button>
        ))}
      </div>
    </div>,

    <div key={3} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Users size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Team Size
          </p>
          <h2 className="text-xl font-bold text-white">How large is your team?</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">
        We'll configure capacity limits and workflows accordingly.
      </p>
      <div className="space-y-2">
        {TEAM_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => setTeamSize(size)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition
              ${teamSize === size
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-medium"
                : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
          >
            {teamSize === size && <CheckCircle2 size={13} className="inline mr-2 mb-0.5" />}
            {size}
          </button>
        ))}
      </div>
    </div>,

    <div key={4} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Globe size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Location
          </p>
          <h2 className="text-xl font-bold text-white">Where are you based?</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">Used for timezone, compliance rules, and clocking.</p>
      <div className="grid grid-cols-2 gap-2">
        {COUNTRIES.map((c) => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={`text-left px-3 py-2.5 rounded-xl border text-sm transition
              ${country === c
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-medium"
                : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
          >
            {country === c && <CheckCircle2 size={12} className="inline mr-1.5 mb-0.5" />}
            {c}
          </button>
        ))}
      </div>
    </div>,

    <div key={5} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Users size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Admin Profile
          </p>
          <h2 className="text-xl font-bold text-white">What's your name?</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">
        This is how you'll appear in the system as the workspace admin.
      </p>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Full Name *</label>
          <input
            autoFocus
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adminName.trim() && goNext()}
            placeholder="e.g. Sarah Oke"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Email (from your account)</label>
          <input value={userEmail} disabled
            className={`${inputCls} opacity-40 cursor-not-allowed`} />
        </div>
      </div>
    </div>,

    <div key={6} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Briefcase size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Departments
          </p>
          <h2 className="text-xl font-bold text-white">Configure your departments</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">
        These appear across recruitment, tasks, and reporting. Edit freely.
      </p>
      <div className="flex flex-wrap gap-2">
        {departments.map((d) => (
          <div key={d}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-zinc-800 border border-zinc-700 text-sm text-zinc-300">
            {d}
            <button onClick={() => setDepts(departments.filter((x) => x !== d))}
              className="text-zinc-600 hover:text-red-400 transition ml-1">
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDept()}
          placeholder="Add department..."
          className={`${inputCls} flex-1`}
        />
        <button onClick={addDept} disabled={!newDept.trim()}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                     text-white text-sm font-medium disabled:opacity-40 transition">
          <Plus size={15} />
        </button>
      </div>
    </div>,

    <div key={7} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <Cpu size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            Xavier AI
          </p>
          <h2 className="text-xl font-bold text-white">Configure automation</h2>
        </div>
      </div>
      <div className="space-y-4">
        {[
          { label: "Auto-score candidates",      sub: "Xavier AI scores every applicant 0-100 instantly",                  val: autoScore,   set: setAutoScore   },
          { label: "Auto-reject below threshold", sub: "Candidates below manual review threshold get auto-rejected",        val: autoReject,  set: setAutoReject  },
          { label: "Auto-trigger onboarding",    sub: "Onboarding starts automatically when offer is accepted",            val: autoOnboard, set: setAutoOnboard },
          { label: "Enable geo-tagging",         sub: "Capture GPS location when staff clock in and out",                  val: geoTag,      set: setGeoTag      },
        ].map(({ label, sub, val, set }) => (
          <div key={label} className="flex items-center justify-between gap-4
                                       border border-zinc-800 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm text-white">{label}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>
            </div>
            <Toggle value={val} onChange={set} />
          </div>
        ))}
      </div>
      <div className="space-y-3 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Scoring Thresholds
        </p>
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Auto-Interview</span>
            <span className="text-emerald-400 font-bold">{thresholdAI}</span>
          </div>
          <input type="range" min={51} max={95} value={thresholdAI}
            onChange={(e) => setThresholdAI(Number(e.target.value))}
            className="w-full accent-emerald-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Manual Review</span>
            <span className="text-amber-400 font-bold">{thresholdMR}</span>
          </div>
          <input type="range" min={20} max={thresholdAI - 1} value={thresholdMR}
            onChange={(e) => setThresholdMR(Number(e.target.value))}
            className="w-full accent-amber-500" />
        </div>
        <p className="text-[10px] text-zinc-600">
          Below {thresholdMR} goes to auto-rejected, {thresholdMR}-{thresholdAI} goes to recruiter review, above {thresholdAI} goes to auto-interview
        </p>
      </div>
    </div>,

    <div key={8} className="p-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                        flex items-center justify-center">
          <CheckCircle2 size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
            All Set
          </p>
          <h2 className="text-xl font-bold text-white">Ready to launch</h2>
        </div>
      </div>
      <p className="text-zinc-500 text-sm">Review your configuration below.</p>
      <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
        {[
          ["Organisation",       orgName],
          ["Industry",           industry],
          ["Team Size",          teamSize],
          ["Country",            country],
          ["Admin",              adminName || userEmail],
          ["Departments",        departments.slice(0,4).join(", ") + (departments.length > 4 ? "..." : "")],
          ["Auto-Score",         autoScore   ? "Enabled" : "Disabled"],
          ["Auto-Reject",        autoReject  ? "Enabled" : "Disabled"],
          ["Interview Threshold",`${thresholdAI}/100`],
          ["Review Threshold",   `${thresholdMR}/100`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-zinc-500">{label}</span>
            <span className="text-white font-medium text-right max-w-[55%] truncate">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20
                      bg-emerald-500/5 px-4 py-3">
        <Shield size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Your workspace is <strong className="text-white">fully isolated</strong> - no other
          customer can see your data. Your unique tenant ID ensures complete data separation.
        </p>
      </div>
    </div>,
  ];

  if (launched) {
    return (
      <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0">
          <RemoteWorkersBg />
        </div>
        <div className="relative z-10 w-full max-w-lg px-4 py-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/25
                          flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Workspace is live</h1>
            <p className="text-zinc-400 text-sm mt-2">
              {orgName} is set up and ready. Share this link with candidates so they can apply directly.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 text-left space-y-3">
            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-semibold">
              Your Apply Link
            </p>
            <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3">
              <span className="text-sm text-zinc-300 truncate flex-1">{applyLink}</span>
              <button onClick={copyApplyLink}
                className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600
                           hover:bg-emerald-500 text-white transition">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Anyone with this link can submit an application - no account needed on their end.
            </p>
          </div>

          <button
            onClick={() => router.replace("/dashboard")}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                       bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
          >
            Go to Dashboard <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((currentStep / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center">

      <div className="absolute inset-0">
        <RemoteWorkersBg />
      </div>

      <div className="relative z-10 w-full max-w-lg px-4 py-8">

        <div className="flex items-center justify-center gap-2.5 mb-8">
          <svg width="28" height="24" viewBox="0 0 100 87" fill="none">
            <path d="M50 3L97 84H3L50 3Z" fill="rgba(34,197,94,0.08)"
              stroke="#22c55e" strokeWidth="4" strokeOpacity="0.6" strokeLinejoin="round"/>
            <path d="M50 24L80 75H20L50 24Z" fill="none"
              stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.35"/>
          </svg>
          <span className="text-lg font-bold tracking-tight text-white">PivotOps</span>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
              Setup Progress
            </span>
            <span className="text-[10px] text-zinc-600">
              {currentStep + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300
                  ${i < currentStep   ? "bg-emerald-500" :
                    i === currentStep ? "bg-emerald-400 ring-2 ring-emerald-500/30 scale-125" :
                                         "bg-zinc-700"
                  }`}
              />
            ))}
          </div>
        </div>

        <div className="overflow-hidden">
          <QuestionCard direction={animState} animKey={animKey}>
            {steps[currentStep]}
          </QuestionCard>
        </div>

        <div className="mt-4 flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={goBack}
              disabled={isExiting}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-700
                         text-sm text-zinc-400 hover:text-white hover:border-zinc-600
                         transition disabled:opacity-40"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              onClick={goNext}
              disabled={!canContinue[currentStep] || isExiting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
                         transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={complete}
              disabled={saving || isExiting}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl
                         bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
                         transition disabled:opacity-50"
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Creating workspace...</>
                : <><CheckCircle2 size={15} /> Finish & Launch</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}