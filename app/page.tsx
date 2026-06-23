"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import CookieConsent from "@/app/components/CookieConsent";

// ── Logo ─────────────────────────────────────────────────────────────────────
function PivotOpsLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.87)} viewBox="0 0 100 87" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="co" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d0" /><stop offset="35%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#909090" /><stop offset="100%" stopColor="#b8b8b8" />
        </linearGradient>
        <linearGradient id="ci" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#606060" /><stop offset="50%" stopColor="#c8c8c8" />
          <stop offset="100%" stopColor="#484848" />
        </linearGradient>
      </defs>
      <path d="M50 3L97 84H3L50 3Z" fill="rgba(255,255,255,0.03)" stroke="url(#co)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M50 24L80 75H20L50 24Z" fill="none" stroke="url(#ci)" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.7" />
    </svg>
  );
}

// ── Compression bar ───────────────────────────────────────────────────────────
function CompressionBar() {
  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 md:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-8">Same team. Same applicants. Different system.</p>
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-zinc-400">Without PivotOps</span>
          <span className="font-mono text-sm text-red-400 font-bold">14-30 days</span>
        </div>
        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-red-900/80 to-red-500/60" style={{ width: "100%" }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono text-zinc-600">
          <span>Job opens. No owner.</span><span>Spreadsheet check</span><span>WhatsApp approval</span><span>Candidate gone</span>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-white">With PivotOps</span>
          <span className="font-mono text-sm text-emerald-400 font-bold">72 hours</span>
        </div>
        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300" style={{ width: "10%", animation: "growBar 1.2s cubic-bezier(0.16,1,0.3,1) both" }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono text-zinc-500">
          <span>Auto-routed instantly</span><span>Scored in seconds</span><span>Interview scheduled</span>
        </div>
      </div>
      <style>{`@keyframes growBar { from { width: 0% } } @media (prefers-reduced-motion: reduce) { div { animation: none } }`}</style>
    </div>
  );
}

// ── Before / After ────────────────────────────────────────────────────────────
function BeforeAfter() {
  const rows = [
    { before: "Job posted. 6 people notified. Nobody owns it.", after: "Auto-assigned to the right recruiter within 60 seconds." },
    { before: "Resume sits in inbox for 3 days waiting for someone to read it.", after: "Parsed, scored 0-100, and ranked before a human looks." },
    { before: "Top candidate accepts another offer while waiting for a reply.", after: "High-score candidates get a decision in hours, not days." },
    { before: "Onboarding starts with a manual email thread and a spreadsheet.", after: "Hire is confirmed, onboarding triggers automatically." },
    { before: "Real status lives in a WhatsApp group nobody can search.", after: "Every decision, message, and task in one searchable system." },
    { before: "Compliance documents chased individually per employee.", after: "Document tracking and reminders run automatically per role." },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <div className="grid grid-cols-2 border-b border-zinc-800">
        <div className="px-5 py-3 bg-red-500/5 border-r border-zinc-800">
          <span className="text-xs font-mono uppercase tracking-widest text-red-500">Before</span>
        </div>
        <div className="px-5 py-3 bg-emerald-500/5">
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">After PivotOps</span>
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 border-b border-zinc-800/50 last:border-0">
          <div className="px-5 py-4 border-r border-zinc-800/50 bg-red-500/[0.02]">
            <p className="text-sm text-zinc-500 leading-relaxed">{r.before}</p>
          </div>
          <div className="px-5 py-4 bg-emerald-500/[0.02]">
            <p className="text-sm text-zinc-300 leading-relaxed">{r.after}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cost savings ──────────────────────────────────────────────────────────────
function CostSavings() {
  const tools = [
    { name: "ATS / CRM",      range: "$12,000 - $20,000/yr" },
    { name: "HR / Workforce", range: "$22,000 - $49,000/yr" },
    { name: "HRIS",           range: "$12,000 - $20,400/yr" },
    { name: "Scheduling",     range: "$2,500 - $3,500/yr"   },
    { name: "Ops tracking",   range: "$875 - $1,700/yr"     },
    { name: "Team comms",     range: "$870 - $1,800/yr"     },
    { name: "Business API",   range: "$480 - $1,200/yr"     },
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">The real cost of doing nothing</p>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 max-w-3xl">Stop paying for 7 tools that do not talk to each other.</h2>
      <p className="text-zinc-400 max-w-2xl leading-relaxed mb-10">
        The average 10-recruiter staffing agency spends <span className="text-white font-semibold">$65,000-$90,000 per year</span> running disconnected tools. Before implementation. Before integrations. Before the time your team loses switching between them.
      </p>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          {tools.map((t, i) => (
            <div key={t.name} className={`flex items-center justify-between px-5 py-3.5 ${i < tools.length - 1 ? "border-b border-zinc-800/60" : ""}`}>
              <span className="text-sm text-zinc-400">{t.name}</span>
              <span className="text-sm font-mono text-red-400 font-semibold">{t.range}</span>
            </div>
          ))}
          <div className="px-5 py-4 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Total annual cost</span>
            <span className="font-mono font-bold text-red-400 text-base">$65,000 - $90,000/yr</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <p className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-3">PivotOps replaces the entire stack</p>
            <p className="text-white text-lg font-semibold leading-snug">One system. One subscription. Time-to-hire drops from 14-30 days to 72 hours.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-3">
            <p className="text-zinc-400 text-sm leading-relaxed">
              Every recruiter on your team wastes an average of <span className="text-white">6-10 hours per week</span> switching between tools, chasing status updates, and manually copying data between systems.
            </p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              At a 10-recruiter agency, that is <span className="text-white font-semibold">60-100 hours of productivity lost every single week</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const TIERS = [
  {
    name: "Starter", sub: "Up to 5 recruiters", monthly: 1500, highlight: false,
    features: ["Full recruitment workflow automation", "Xavier AI candidate scoring (0-100)", "Interview routing and scheduling", "Real-time in-app notifications", "Auto-decline with branded comms", "Candidate compliance portal"],
  },
  {
    name: "Professional", sub: "5-20 recruiters", monthly: 2500, highlight: true,
    features: ["Everything in Starter", "Advanced compliance document tracking", "Multi-channel candidate communications", "Performance dashboards and analytics", "Employee clock in/out with geolocation", "Onboarding auto-trigger on hire"],
  },
  {
    name: "Enterprise", sub: "Multi-location or compliance-heavy", monthly: 6000, highlight: false,
    features: ["Everything in Professional", "Dedicated implementation and onboarding", "Custom integrations and API access", "Priority support and SLA agreement", "Advanced access controls and audit trail", "Custom compliance workflows"],
  },
];

function PricingSection() {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  return (
    <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Simple, transparent pricing</p>
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-xl">Priced for the team you are running today.</h2>
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 p-1">
          <button onClick={() => setAnnual(false)} className={`px-4 py-2 rounded-full text-sm font-medium transition ${!annual ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>Monthly</button>
          <button onClick={() => setAnnual(true)} className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${annual ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            Annual
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${annual ? "bg-emerald-600 text-white" : "bg-emerald-500/15 text-emerald-400"}`}>Save 10%</span>
          </button>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((t) => {
          const price = annual ? Math.round(t.monthly * 0.9) : t.monthly;
          const annualTotal = Math.round(t.monthly * 12 * 0.9);
          return (
            <div key={t.name} className={`rounded-2xl p-7 flex flex-col relative ${t.highlight ? "border-2 border-emerald-500 bg-emerald-500/[0.04]" : "border border-zinc-800"}`}>
              {t.highlight && <span className="absolute -top-3 left-6 bg-emerald-500 text-zinc-950 text-[11px] font-bold px-3 py-1 rounded-full">Most popular</span>}
              <h3 className="text-white font-bold text-lg">{t.name}</h3>
              <p className="text-sm text-zinc-500 mt-1">{t.sub}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">${price.toLocaleString()}</span>
                <span className="text-zinc-500 text-base">/mo</span>
              </div>
              {annual && <p className="text-xs text-zinc-600 mt-1">Billed ${annualTotal.toLocaleString()}/yr</p>}
              <ul className="mt-6 space-y-2.5 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.highlight ? "bg-emerald-400" : "bg-zinc-600"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push("/login?mode=signup&tier=" + t.name.toLowerCase())}
                className={`mt-7 w-full py-3 rounded-xl text-sm font-bold transition ${t.highlight ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950" : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"}`}>
                Get started
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-center text-zinc-600 text-sm mt-6">Save 10% on any annual plan. No setup fees. Cancel anytime.</p>
    </section>
  );
}

// ── Xavier chat widget ────────────────────────────────────────────────────────
const SUGGESTED = [
  "What does PivotOps actually do?",
  "Which plan is right for me?",
  "How fast is implementation?",
  "How does this compare to Bullhorn?",
  "What is included in Enterprise?",
];

const XAVIER_SYSTEM = `You are Xavier, PivotOps AI advisor on the landing page. Help prospects understand the product and choose the right plan. Be direct, confident, and helpful. Never be salesy or pushy. Answer honestly.

PivotOps is a workforce operations platform: application intake, AI scoring (0-100), interview routing, onboarding, team communication, compliance tracking, and clock in/out.

Key facts:
- Time-to-hire: 14-30 days to 72 hours
- Replaces: ATS/CRM, HR tools, HRIS, scheduling, ops tracking, team comms - saving $65,000-$90,000/yr

Pricing:
- Starter: $1,500/month (up to 5 recruiters)
- Professional: $2,500/month (5-20 recruiters) - most popular
- Enterprise: $6,000/month (multi-location or compliance-heavy)
- Annual plans save 10%

When helping choose a plan: ask how many recruiters, if they need compliance tracking, if multi-location.`;

async function askXavier(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: XAVIER_SYSTEM,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "I could not process that. Please try again.";
}

function XavierChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; id: number }[]>([
    { role: "assistant", content: "Hi, I am Xavier, PivotOps AI advisor. Ask me anything about the platform, pricing, or whether it is the right fit for your team.", id: 0 }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text.trim(), id: idRef.current++ };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    const apiMessages = [...messages.slice(1), userMsg].map(m => ({ role: m.role, content: m.content }));
    try {
      const reply = await askXavier(apiMessages);
      setMessages(prev => [...prev, { role: "assistant", content: reply, id: idRef.current++ }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again.", id: idRef.current++ }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-2xl
                 bg-[#0B1D3A] hover:bg-[#0d2244] border border-[#00BFA6]/30
                 shadow-2xl shadow-[#00BFA6]/20 transition">
      <div className="relative w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-[#00BFA6]/40">
        <img src="/xavier-avatar.png" alt="Xavier" className="w-full h-full object-cover object-top" />
      </div>
      <div className="text-left">
        <p className="text-white text-xs font-bold leading-tight">Ask Xavier</p>
        <p className="text-[10px] leading-tight" style={{ color: "#00BFA6" }}>AI advisor · online</p>
      </div>
      <span className="w-2 h-2 rounded-full animate-pulse ml-1" style={{ background: "#00BFA6" }} />
    </button>
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[600px] flex flex-col
                    rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
      style={{ border: "1px solid rgba(0,191,166,0.25)", background: "#090d17" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,191,166,0.2)", background: "rgba(11,29,58,0.95)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
            style={{ border: "1px solid rgba(0,191,166,0.4)" }}>
            <img src="/xavier-avatar.png" alt="Xavier" className="w-full h-full object-cover object-top" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Xavier AI</p>
            <p className="text-[10px]" style={{ color: "#00BFA6" }}>PivotOps advisor · online</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-white transition text-xl leading-none w-7 h-7 flex items-center justify-center">x</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-[380px]">
        {messages.map((m) => (
          <div key={m.id} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
              (m.role === "user"
                ? "text-white rounded-br-sm"
                : "text-zinc-300 rounded-bl-sm")}
              style={m.role === "user"
                ? { background: "rgba(30,86,224,0.25)", border: "1px solid rgba(30,86,224,0.2)" }
                : { background: "rgba(11,29,58,0.8)", border: "1px solid rgba(0,191,166,0.1)" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1"
              style={{ background: "#0B1D3A", border: "1px solid rgba(0,191,166,0.1)" }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: "#00BFA6", animationDelay: i * 0.15 + "s" }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-zinc-700
                         text-zinc-400 hover:text-white hover:border-zinc-500 transition">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 pb-2 flex gap-2">
        <button onClick={() => router.push("/login?mode=signup")}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition text-white"
          style={{ background: "linear-gradient(135deg, #1E56E0, #00BFA6)" }}>
          Get started
        </button>
        <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          className="flex-1 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-semibold hover:bg-zinc-700 transition">
          View pricing
        </button>
      </div>

      {/* Input */}
      <div className="p-3 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Ask anything..."
          className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <button onClick={() => send(input)} disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition text-base font-bold text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #1E56E0, #00BFA6)" }}>
          ^
        </button>
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "What does PivotOps actually do?", a: "PivotOps automates the entire path from a job opening to a working employee: intake, AI scoring, interview routing, onboarding, task routing, compliance tracking, and attendance - running as one system instead of five disconnected tools." },
  { q: "Is this an ATS replacement?", a: "No. PivotOps is the coordination and decision-routing layer that ATS software was never built for - the part your team currently runs over WhatsApp and spreadsheets. It sits on top of what you already have." },
  { q: "Who is PivotOps for?", a: "Staffing agencies and workforce-heavy teams - from healthcare staffing to merchant and retail operations - running anywhere from a handful of employees to multi-location teams who feel the daily cost of slow hiring." },
  { q: "How long does setup take?", a: "A first pilot is scoped around your active pipeline, not a six-month implementation. Expect a live workflow within weeks, mapped to your actual process from day one." },
  { q: "Do we need to replace our current tools?", a: "No. PivotOps sits on top of what you already run. The goal in an early pilot is to prove the time-to-hire compression - not force a tool migration before you have seen results." },
  { q: "How is this different from Bullhorn or Workday?", a: "Those are systems of record - built to store data. PivotOps is built to run the daily operating rhythm: who owns a role right now, what happens the moment an application lands, and how a decision gets made without a WhatsApp thread." },
  { q: "What results should we expect?", a: "The target is compressing your hiring loop from 14-30 days down to a 72-hour window for intake through interview scheduling, measured against your own pipeline during a pilot." },
  { q: "Is it secure enough for compliance-sensitive teams?", a: "Yes. PivotOps includes compliance document tracking, tenant-isolated data access, and audit logging as core features, not add-ons. Enterprise plans include a compliance review before rollout." },
];

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800">
      {FAQS.map((item, i) => (
        <div key={item.q}>
          <button onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left flex items-center justify-between gap-4 px-5 py-4">
            <span className="text-sm md:text-[15px] font-medium text-zinc-100">{item.q}</span>
            <span className={"shrink-0 font-mono text-zinc-500 text-xl transition-transform leading-none " + (open === i ? "rotate-45" : "")}>+</span>
          </button>
          {open === i && <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">{item.a}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="bg-zinc-950 text-white min-h-screen">

      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PivotOpsLogo size={28} />
            <span className="font-bold tracking-tight text-white">PivotOps</span>
            <span className="hidden md:inline-flex items-center rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
              Now booking 2026 pilots
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#how-it-works" className="hover:text-white transition">How it works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>
          <button onClick={() => router.push("/login")}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-2 rounded-xl text-sm transition">
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(16,185,129,0.08),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="mb-8 flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-600">Already decided?</span>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition underline underline-offset-2">
              Jump to pricing
            </button>
          </div>
          <div className="max-w-4xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-4">
              Workforce operations - Hiring to day-to-day team coordination
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-[3.6rem] font-black tracking-tight leading-[1.05] mb-6">
              Your hiring workflow is bleeding you dry.
              <span className="block text-emerald-400 mt-2">72 hours fixes that.</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl leading-relaxed mb-8">
              PivotOps replaces the 7 disconnected tools your team is fighting with every day and compresses a 14-30 day hiring cycle into a 72-hour automated loop. One system. No more WhatsApp threads.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => router.push("/login?mode=signup")}
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-8 py-4 rounded-xl text-base transition shadow-2xl shadow-emerald-500/20">
                Get started today
              </button>
              <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-zinc-700 hover:border-zinc-500 text-zinc-200 font-semibold px-8 py-4 rounded-xl text-base transition">
                See how it works
              </button>
            </div>
          </div>
          <div className="mt-14">
            <CompressionBar />
          </div>
        </div>
      </section>

      {/* Credibility strip */}
      <section className="border-y border-zinc-900 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-zinc-400">
          <p><span className="text-white font-bold">$65K-$90K saved annually</span> by replacing 7 disconnected tools with one system.</p>
          <p><span className="text-white font-bold">72-hour time-to-hire</span> versus the industry average of 14-30 days.</p>
          <p><span className="text-white font-bold">Built by an operator</span> who ran the exact workflow PivotOps now automates.</p>
        </div>
      </section>

      {/* Before / After */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">The real difference</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-2xl">What your team day looks like before and after.</h2>
        <BeforeAfter />
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">The problem</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Every day a role stays open is margin handed directly to a competitor who moved faster.</h2>
          </div>
          <div className="space-y-4 text-zinc-400 leading-relaxed">
            <p>The applicants are there. They get lost in the gap between submission and decision - a job opens with no clear owner, applications sit in a spreadsheet nobody checks, and an approval waits on a WhatsApp reply that never comes.</p>
            <p>You have likely already bought an ATS. You are probably still running the real coordination across email, spreadsheets, and group chats. <span className="text-white">The tool was never the problem. The workflow was.</span></p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">How it works</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight max-w-2xl mb-10">Five steps. One continuous system.</h2>
        <div className="grid md:grid-cols-5 gap-px bg-zinc-800 rounded-2xl overflow-hidden">
          {[
            { n: "01", t: "Intake",  d: "Applicants apply through the portal. Zero manual data entry on your side." },
            { n: "02", t: "Score",   d: "Xavier AI scores each applicant 0-100 against your role criteria instantly." },
            { n: "03", t: "Route",   d: "High scores go straight to interview. Mid scores queue for human review." },
            { n: "04", t: "Decide",  d: "Approvals trigger scheduling and onboarding. Low-fit gets auto-decline." },
            { n: "05", t: "Run",     d: "Tasks, compliance, comms, and clock in/out all live in the same system." },
          ].map((s) => (
            <div key={s.n} className="bg-zinc-950 p-6">
              <span className="font-mono text-xs text-zinc-600">{s.n}</span>
              <h3 className="text-white font-semibold mt-3 mb-1.5">{s.t}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">What is built in</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[
            { t: "Xavier AI Scoring",           d: "Every application scored 0-100 the moment it lands. No human bottleneck on first-pass decisions." },
            { t: "72-Hour Hiring Loop",          d: "Automated routing from application to interview scheduled - before your competitor responds to their first email." },
            { t: "Realtime Team Communication",  d: "In-app messaging, @mentions, and task routing. Nothing waits on a WhatsApp thread." },
            { t: "Compliance Document Tracking", d: "Required credentials tracked per employee with automatic reminders. Audit trail built in." },
            { t: "Onboarding Auto-Trigger",      d: "The moment someone is hired, onboarding starts. No manual handoff. No dropped balls." },
            { t: "Clock In/Out + Geolocation",   d: "Employees clock in with location verification. Shift compliance tracked automatically." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5">
              <h3 className="font-semibold text-emerald-400 mb-2">{f.t}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cost savings + Pricing */}
      <CostSavings />
      <PricingSection />

      {/* Final CTA */}
      <section className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-4">Ready to move</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-[1.05] mb-6">
            Your competitors are already moving faster.
            <span className="block text-emerald-400 mt-2">Start your 72-hour loop today.</span>
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-lg mb-10">No migration required. No six-month implementation. Bring your current pipeline and we will show you the compression in weeks.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => router.push("/login?mode=signup")}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-10 py-4 rounded-xl text-lg transition shadow-2xl shadow-emerald-500/25">
              Get started now
            </button>
            <button onClick={() => router.push("/login")}
              className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold px-10 py-4 rounded-xl text-lg transition">
              Sign in
            </button>
          </div>
          <p className="mt-6 text-zinc-600 text-sm">No credit card required to start - Cancel anytime</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-900">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Questions</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-10">Common questions</h2>
        <FAQAccordion />
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PivotOpsLogo size={24} />
                <span className="font-bold text-white">PivotOps</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">Workforce operations, run as one system. From application to working day.</p>
              <p className="text-xs text-zinc-700">A product by Craftstreams</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-600">Product</p>
              <div className="space-y-2 text-sm text-zinc-500">
                <a href="#how-it-works" className="block hover:text-white transition">How it works</a>
                <a href="#pricing" className="block hover:text-white transition">Pricing</a>
                <a href="#faq" className="block hover:text-white transition">FAQ</a>
                <a href="/login?mode=signup" className="block hover:text-white transition">Get started</a>
                <a href="/login" className="block hover:text-white transition">Sign in</a>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-600">Company</p>
              <div className="space-y-2 text-sm text-zinc-500">
                <p>Built by Craftstreams</p>
                <p>Distribution partner: Shopline</p>
                <p>Serving US, Singapore and APAC</p>
                <a href="mailto:support@pivotops.app" className="block hover:text-white transition">support@pivotops.app</a>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-600">Legal</p>
              <div className="space-y-2 text-sm text-zinc-500">
                <a href="/legal/terms" className="block hover:text-white transition">Terms of Use</a>
                <a href="/legal/privacy" className="block hover:text-white transition">Privacy Policy</a>
                <a href="/legal/refunds" className="block hover:text-white transition">Refund Policy</a>
                <button onClick={() => { localStorage.removeItem("pivotops_cookie_consent"); window.location.reload(); }}
                  className="block text-left text-sm text-zinc-500 hover:text-white transition">Cookie Preferences</button>
                <a href="mailto:legal@pivotops.app" className="block hover:text-white transition">legal@pivotops.app</a>
                <a href="mailto:privacy@pivotops.app" className="block hover:text-white transition">privacy@pivotops.app</a>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-900 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-700">
            <p>2024-2026 Craftstreams. PivotOps is a trademark of Craftstreams. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/legal/terms" className="hover:text-zinc-400 transition">Terms of Use</a>
              <span>·</span>
              <a href="/legal/privacy" className="hover:text-zinc-400 transition">Privacy Policy</a>
              <span>·</span>
              <a href="/legal/refunds" className="hover:text-zinc-400 transition">Refund Policy</a>
              <span>·</span>
              <button onClick={() => { localStorage.removeItem("pivotops_cookie_consent"); window.location.reload(); }}
                className="hover:text-zinc-400 transition">Cookie Settings</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Xavier chat widget */}
      <XavierChat />

      {/* Cookie consent banner */}
      <CookieConsent />
    </div>
  );
}