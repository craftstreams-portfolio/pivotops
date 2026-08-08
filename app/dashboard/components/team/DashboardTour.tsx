"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TourStep = { key: string; title: string; body: string };

const TOUR_STEPS: TourStep[] = [
  { key: "nav-Overview", title: "Overview", body: "Your home base - a live snapshot of hiring, compliance, and team activity." },
  { key: "nav-Workforce Operations", title: "Workforce Operations", body: "Recruitment, onboarding, offboarding, compliance, tasks, and clocking all live here." },
  { key: "nav-Pivot Teams", title: "Pivot Teams", body: "Team chat, calendar, conference, and Huddles - your day-to-day coordination layer." },
  { key: "nav-Analytics", title: "Analytics", body: "Realtime metrics on hiring efficiency and automation coverage." },
  { key: "nav-Settings", title: "Settings", body: "Manage your workspace configuration anytime." },
];

export default function DashboardTour({ targets }: { targets: Record<string, HTMLElement | null> }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Per-user DB flag, not localStorage (see XavierIntro). Fails OPEN.
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (uid) {
          setUserId(uid);
          const { data } = await supabase
            .from("profiles")
            .select("tour_seen")
            .eq("id", uid)
            .maybeSingle();
          if (data?.tour_seen) return;
        }
      } catch {
        // fall through and show it
      }
      setActive(true);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    const el = targets[step.key];
    if (el) setRect(el.getBoundingClientRect());
  }, [active, stepIndex, targets]);

  function finish() {
    setActive(false);
    if (userId) {
      supabase.from("profiles").update({ tour_seen: true }).eq("id", userId)
        .then(({ error }) => { if (error) console.error("[DashboardTour] could not persist seen flag:", error.message); });
    }
  }

  function next() {
    if (stepIndex < TOUR_STEPS.length - 1) setStepIndex((s) => s + 1);
    else finish();
  }

  if (!active || !rect) return null;
  const step = TOUR_STEPS[stepIndex];

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70" onClick={finish} />
      <div
        className="absolute rounded-xl ring-2 ring-emerald-400 pointer-events-none transition-all duration-300"
        style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
      />
      <div
        className="absolute w-72 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
        style={{ top: Math.min(rect.bottom + 12, window.innerHeight - 180), left: Math.min(rect.left, window.innerWidth - 300) }}
      >
        <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold mb-1">
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </p>
        <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">{step.body}</p>
        <div className="flex justify-between items-center">
          <button onClick={finish} className="text-xs text-zinc-500 hover:text-white transition">Skip tour</button>
          <button onClick={next} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition">
            {stepIndex < TOUR_STEPS.length - 1 ? "Next" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}