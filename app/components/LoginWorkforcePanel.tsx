"use client";

import { useEffect, useState } from "react";

/**
 * app/components/LoginWorkforcePanel.tsx
 *
 * Animated workforce board for the login split screen. Shows what PivotOps
 * actually does - staff status, shift coverage, candidate scoring - rather
 * than an abstract graphic. Pure CSS/SVG, no images or libraries.
 *
 * All names and figures are illustrative, not real customer data.
 */

const STAFF = [
  { name: "A. Rivera",   role: "Warehouse",     initials: "AR" },
  { name: "P. Nandakumar", role: "Supervisor",  initials: "PN" },
  { name: "M. Feldstein", role: "Retail Floor", initials: "MF" },
  { name: "D. Okonkwo",  role: "Fulfillment",   initials: "DO" },
];

type Status = "working" | "break" | "offline";
const CYCLE: Status[][] = [
  ["working", "working", "break",   "offline"],
  ["working", "break",   "working", "offline"],
  ["working", "working", "working", "working"],
  ["break",   "working", "working", "working"],
];

const STATUS_STYLE: Record<Status, { dot: string; label: string; text: string }> = {
  working: { dot: "#10B981", label: "On shift", text: "#6EE7B7" },
  break:   { dot: "#F59E0B", label: "On break", text: "#FCD34D" },
  offline: { dot: "#3F3F46", label: "Off",      text: "#71717A" },
};

export function LoginWorkforcePanel() {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(71);
  const [coverage, setCoverage] = useState(76);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % CYCLE.length), 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setScore((v) => (v >= 92 ? 71 : v + 1));
      setCoverage((v) => (v >= 98 ? 76 : v + 1));
    }, 90);
    return () => clearInterval(id);
  }, []);

  const statuses = CYCLE[step];

  return (
    <div className="relative w-full max-w-md">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -inset-16 opacity-25 blur-[90px]"
           style={{ background: "radial-gradient(circle at 60% 40%, #00BFA6 0%, transparent 70%)" }} />

      <div className="relative rounded-3xl border border-white/10 bg-[#0c0e14]/80 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Live workforce</p>
            <p className="text-sm font-semibold text-white mt-0.5">Northwind Retail Co</p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        <div className="space-y-2 mb-5">
          {STAFF.map((p, i) => {
            const s = STATUS_STYLE[statuses[i]];
            return (
              <div key={p.name}
                   className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors duration-700">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
                                 bg-white/5 text-[10px] font-semibold text-zinc-400">
                  {p.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-zinc-600">{p.role}</p>
                </div>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full transition-colors duration-700"
                        style={{ background: s.dot }} />
                  <span className="text-[10px] transition-colors duration-700" style={{ color: s.text }}>
                    {s.label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[10px] text-zinc-600 mb-1.5">Shift coverage</p>
            <p className="font-mono text-lg font-bold tabular-nums text-white">{coverage}%</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-100"
                   style={{ width: `${coverage}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[10px] text-zinc-600 mb-1.5">Candidate score</p>
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