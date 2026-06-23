"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Xavier brand colours ──────────────────────────────────────────────────────
const NAVY  = "#0B1D3A";
const BLUE  = "#1E56E0";
const TEAL  = "#00BFA6";

// ── Kanban capability cards ───────────────────────────────────────────────────
const CARDS = [
  {
    icon: "🎯",
    title: "Smart Sourcing",
    body: "I score every applicant 0–100 the moment they apply. Top talent gets routed to interview before your competitor opens their inbox.",
    link: "/dashboard/recruitment",
    color: TEAL,
  },
  {
    icon: "📅",
    title: "Interview Assistant",
    body: "I schedule interviews, send candidate confirmations, and generate token-gated links — no calendar ping needed from your team.",
    link: "/dashboard/recruitment",
    color: BLUE,
  },
  {
    icon: "⚡",
    title: "Workflow Automation",
    body: "Hire confirmed → onboarding starts. Compliance docs requested. Tasks assigned. Everything triggered automatically the moment a decision is made.",
    link: "/dashboard/onboarding",
    color: TEAL,
  },
  {
    icon: "🛡️",
    title: "Compliance Tracking",
    body: "I track every required credential per employee, send reminders, and flag gaps before they become audit problems.",
    link: "/dashboard/compliance",
    color: BLUE,
  },
  {
    icon: "📊",
    title: "Insights & Reporting",
    body: "Time-to-hire, conversion rates, fatigue analysis, and workforce health — all updated in real time as your team moves.",
    link: "/dashboard/analytics",
    color: TEAL,
  },
  {
    icon: "💬",
    title: "Ask Me Anything",
    body: "Your pipeline, your team, your compliance gaps — ask me anything about your workforce and I will surface the answer immediately.",
    link: "/dashboard/teams",
    color: BLUE,
  },
];

// ── Typing animation hook ─────────────────────────────────────────────────────
function useTypingEffect(text: string, speed = 28, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, active]);
  return { displayed, done };
}

// ── Volume bars animation ─────────────────────────────────────────────────────
function VolumeBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-4">
      {[0,1,2,3,4].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all"
          style={{
            height: active ? `${6 + Math.sin(Date.now()/200 + i*0.8) * 6 + Math.random() * 4}px` : "3px",
            background: `linear-gradient(180deg, ${TEAL}, ${BLUE})`,
            animation: active ? `bounce ${0.4 + i*0.1}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}

    </div>
  );
}

// ── Xavier avatar ─────────────────────────────────────────────────────────────
function XavierAvatar({ size = 80, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {pulse && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: TEAL }}
        />
      )}
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-black"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
          fontSize: size * 0.35,
          border: `3px solid ${TEAL}`,
          boxShadow: `0 0 0 2px ${NAVY}, 0 8px 32px rgba(0,191,166,0.3)`,
        }}
      >
        X
      </div>
      <div
        className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
        style={{ background: TEAL, borderColor: "#080810" }}
      />
    </div>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────
function KanbanCard({
  card, index, visible, onNavigate,
}: {
  card: typeof CARDS[0];
  index: number;
  visible: boolean;
  onNavigate: (link: string) => void;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer group transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, ${NAVY}ee, #0d1929ee)`,
        border: `1px solid ${card.color}33`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        transitionDelay: `${index * 80}ms`,
      }}
      onClick={() => onNavigate(card.link)}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${card.color}18`, border: `1px solid ${card.color}30` }}
        >
          {card.icon}
        </div>
        <div
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition"
          style={{ color: card.color, background: `${card.color}15` }}
        >
          Explore →
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-white mb-1">{card.title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{card.body}</p>
      </div>
      <div
        className="h-0.5 rounded-full w-0 group-hover:w-full transition-all duration-500"
        style={{ background: `linear-gradient(90deg, ${card.color}, transparent)` }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function XavierIntro({ userName }: { userName?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"hidden" | "backdrop" | "avatar" | "greeting" | "cards" | "cta">("hidden");


  const [cardsVisible, setCardsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const greeting = userName
    ? `Hi ${userName.split(" ")[0]}, I'm Xavier — your Workforce Intelligence Partner.`
    : `Hi, I'm Xavier — your Workforce Intelligence Partner.`;

  const subline = "I analyze, automate, and anticipate so you can focus on people. Here's what I'll be doing for you.";

  const { displayed: greetingText, done: greetingDone } = useTypingEffect(
    greeting, 30, phase === "greeting"
  );
  const { displayed: subText } = useTypingEffect(
    subline, 22, greetingDone
  );

  useEffect(() => {
    const seen = localStorage.getItem("pivotops_xavier_intro_seen");
    if (seen) return;

    // Staggered entrance
    timerRef.current = setTimeout(() => setPhase("backdrop"), 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (phase === "backdrop") {
      timerRef.current = setTimeout(() => setPhase("avatar"), 400);
    } else if (phase === "avatar") {
      timerRef.current = setTimeout(() => setPhase("greeting"), 800);
    } else if (phase === "greeting") {
      timerRef.current = setTimeout(() => {
        setPhase("cards");
        setTimeout(() => setCardsVisible(true), 100);
        setTimeout(() => setPhase("cta"), 1200);
      }, 3200);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pivotops_xavier_intro_seen", "1");
  };

  const handleNavigate = (link: string) => {
    handleDismiss();
    router.push(link);
  };

  if (phase === "hidden" || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{
        background: phase === "backdrop" || phase === "avatar" || phase === "greeting" || phase === "cards" || phase === "cta"
          ? "rgba(4,6,14,0.92)"
          : "transparent",
        backdropFilter: "blur(12px)",
        transition: "background 0.6s ease",
      }}
    >
      {/* Radial glow behind Xavier */}
      <div
        className="absolute"
        style={{
          width: 600,
          height: 600,
          background: `radial-gradient(circle, ${TEAL}0a 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div className="relative w-full max-w-5xl flex flex-col gap-6">

        {/* ── Header: Xavier intro ── */}
        <div
          className="flex items-start gap-5 transition-all duration-700"
          style={{
            opacity: phase === "avatar" || phase === "greeting" || phase === "cards" || phase === "cta" ? 1 : 0,
            transform: phase === "avatar" || phase === "greeting" || phase === "cards" || phase === "cta"
              ? "translateY(0)" : "translateY(-20px)",
          }}
        >
          <XavierAvatar size={72} pulse={phase === "avatar" || phase === "greeting"} />

          <div className="flex-1 min-w-0">
            {/* Name badge */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-full font-semibold"
                style={{ color: TEAL, background: `${TEAL}18`, border: `1px solid ${TEAL}30` }}
              >
                Xavier AI
              </span>
              <VolumeBars active={phase === "greeting"} />
              <span className="text-xs text-zinc-600">Online</span>
            </div>

            {/* Typing greeting */}
            {(phase === "greeting" || phase === "cards" || phase === "cta") && (
              <div
                className="rounded-2xl rounded-tl-sm p-5"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}cc, #0d1929cc)`,
                  border: `1px solid ${BLUE}30`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
                }}
              >
                <p className="text-white font-semibold text-base leading-snug mb-2">
                  {greetingText}
                  {phase === "greeting" && !greetingDone && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                      style={{ background: TEAL }} />
                  )}
                </p>
                {greetingDone && (
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {subText}
                    {subText.length < subline.length && (
                      <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse"
                        style={{ background: TEAL }} />
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Skip button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-xs text-zinc-600 hover:text-zinc-400 transition px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600"
          >
            Skip intro
          </button>
        </div>

        {/* ── Kanban cards ── */}
        {(phase === "cards" || phase === "cta") && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CARDS.map((card, i) => (
              <KanbanCard
                key={card.title}
                card={card}
                index={i}
                visible={cardsVisible}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}

        {/* ── CTA bar ── */}
        {phase === "cta" && (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl px-6 py-4 transition-all duration-500"
            style={{
              background: `linear-gradient(135deg, ${NAVY}ee, #0d1929ee)`,
              border: `1px solid ${TEAL}25`,
              boxShadow: `0 4px 32px rgba(0,191,166,0.08)`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <XavierAvatar size={36} />
              <div>
                <p className="text-white text-sm font-semibold">
                  &quot;I don&apos;t just give you data. I help you make better decisions, faster.&quot;
                </p>
                <p className="text-xs mt-0.5" style={{ color: TEAL }}>— Xavier</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleNavigate("/dashboard")}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition"
                style={{
                  background: `linear-gradient(135deg, ${BLUE}, ${TEAL})`,
                  color: "#fff",
                  boxShadow: `0 4px 16px rgba(0,191,166,0.25)`,
                }}
              >
                Let&apos;s get started
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
