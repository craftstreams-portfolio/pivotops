"use client";

import { useEffect, useState } from "react";

/**
 * app/components/LoginWorkforcePanel.tsx
 *
 * Animated workforce board for the login split screen. Each row runs its own
 * event ticker - names slide out to the left and are replaced, cycling
 * through shift, hiring, and task events so the board reads as a live feed
 * rather than a static mock. Pure CSS, no images or libraries.
 *
 * All names and figures are illustrative, not real customer data.
 */

type EventKind = "shift" | "hired" | "task" | "break" | "clockout";

interface FeedEvent {
  initials: string;
  name: string;
  kind: EventKind;
  detail: string;
}

const KIND_STYLE: Record<EventKind, { dot: string; text: string; label: string }> = {
  shift:    { dot: "#10B981", label: "On shift",     text: "#6EE7B7" },
  hired:    { dot: "#00BFA6", label: "Hired",        text: "#5EEAD4" },
  task:     { dot: "#818CF8", label: "Task assigned",text: "#A5B4FC" },
  break:    { dot: "#F59E0B", label: "On break",     text: "#FCD34D" },
  clockout: { dot: "#71717A", label: "Clocked out",  text: "#A1A1AA" },
};

/* Four independent streams, offset so rows never change in unison. */
const STREAMS: FeedEvent[][] = [
  [
    { initials: "AR", name: "Alex Rivera",      kind: "shift",    detail: "Warehouse · 6h 12m" },
    { initials: "TB", name: "Tomas Berg",       kind: "hired",    detail: "Inventory Coordinator" },
    { initials: "GW", name: "Grace Whitmore",   kind: "task",     detail: "Stock count · Aisle 4" },
    { initials: "MF", name: "Maya Feldstein",   kind: "break",    detail: "Retail Floor · 12m" },
  ],
  [
    { initials: "PN", name: "Priya Nandakumar", kind: "shift",    detail: "Supervisor · 3h 48m" },
    { initials: "DO", name: "Daniel Okonkwo",   kind: "task",     detail: "Receiving · Dock 2" },
    { initials: "HT", name: "Hiroshi Tanaka",   kind: "hired",    detail: "Shift Supervisor" },
    { initials: "LB", name: "Leah Brennan",     kind: "shift",    detail: "Store Manager · 7h 02m" },
  ],
  [
    { initials: "MF", name: "Maya Feldstein",   kind: "shift",    detail: "Retail Floor · 4h 30m" },
    { initials: "AR", name: "Alex Rivera",      kind: "task",     detail: "Pallet check · Bay 7" },
    { initials: "GW", name: "Grace Whitmore",   kind: "clockout", detail: "Shift complete · 8h" },
    { initials: "PN", name: "Priya Nandakumar", kind: "task",     detail: "Rota review · Week 42" },
  ],
  [
    { initials: "DO", name: "Daniel Okonkwo",   kind: "break",    detail: "Fulfillment · 8m" },
    { initials: "LB", name: "Leah Brennan",     kind: "task",     detail: "Compliance docs · 3 due" },
    { initials: "TB", name: "Tomas Berg",       kind: "shift",    detail: "Inventory · 1h 15m" },
    { initials: "HT", name: "Hiroshi Tanaka",   kind: "clockout", detail: "Shift complete · 9h" },
  ],
];

function FeedRow({ stream, delay }: { stream: FeedEvent[]; delay: number }) {
  const [idx, setIdx] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    let alive = true;
    const start = setTimeout(() => {
      const tick = () => {
        if (!alive) return;
        setOut(true);                                  // slide current out left
        setTimeout(() => {
          if (!alive) return;
          setIdx((i) => (i + 1) % stream.length);
          setOut(false);                               // next slides in
        }, 420);
      };
      tick();
      const id = setInterval(tick, 3400);
      return () => clearInterval(id);
    }, delay);
    return () => { alive = false; clearTimeout(start); };
  }, [stream.length, delay]);

  const e = stream[idx];
  const s = KIND_STYLE[e.kind];

  return (
    <div className="relative h-[52px] overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div
        className="absolute inset-0 flex items-center gap-3 px-3"
        style={{
          transform: out ? "translateX(-110%)" : "translateX(0)",
          opacity: out ? 0 : 1,
          transition: "transform 420ms cubic-bezier(.4,0,.2,1), opacity 420ms ease",
        }}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
                         bg-white/5 text-[10px] font-semibold text-zinc-400">
          {e.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white">{e.name}</p>
          <p className="truncate text-[10px] text-zinc-600">{e.detail}</p>
        </div>
        <span className="flex flex-shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
          <span className="text-[10px] whitespace-nowrap" style={{ color: s.text }}>{s.label}</span>
        </span>
      </div>
    </div>
  );
}

export function LoginWorkforcePanel() {
  const [coverage, setCoverage] = useState(76);
  const [score, setScore] = useState(71);

  useEffect(() => {
    const id = setInterval(() => {
      setCoverage((v) => (v >= 98 ? 76 : v + 1));
      setScore((v) => (v >= 92 ? 71 : v + 1));
    }, 90);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      <div className="pointer-events-none absolute -inset-16 opacity-25 blur-[90px]"
           style={{ background: "radial-gradient(circle at 60% 40%, #00BFA6 0%, transparent 70%)" }} />

      <div className="relative rounded-3xl border border-white/10 bg-[#0c0e14]/80 p-6 backdrop-blur-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Live workforce</p>
            <p className="mt-0.5 text-sm font-semibold text-white">Northwind Retail Co</p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        <div className="mb-5 space-y-2">
          {STREAMS.map((stream, i) => (
            <FeedRow key={i} stream={stream} delay={i * 850} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1.5 text-[10px] text-zinc-600">Shift coverage</p>
            <p className="font-mono text-lg font-bold tabular-nums text-white">{coverage}%</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-100"
                   style={{ width: `${coverage}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1.5 text-[10px] text-zinc-600">Candidate score</p>
            <p className="font-mono text-lg font-bold tabular-nums" style={{ color: "#00BFA6" }}>{score}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full transition-[width] duration-100"
                   style={{ width: `${score}%`, background: "#00BFA6" }} />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-zinc-600">
        Hiring, shifts, and compliance for the people<br />who actually run the operation.
      </p>
    </div>
  );
}