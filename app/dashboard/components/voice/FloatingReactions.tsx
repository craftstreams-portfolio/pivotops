"use client";

import { useEffect, useRef, useState } from "react";

interface Particle {
  id: string;
  emoji: string;
  left: number;
  drift: number;
  size: number;
  duration: number;
  delay: number;
  rotate: number;
}

let seq = 0;

export default function FloatingReactions({
  trigger,
  originX,
}: {
  trigger: { id: string; emoji: string } | null;
  originX?: number;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!trigger || trigger.id === lastId.current) return;
    lastId.current = trigger.id;

    const base = originX ?? 50;
    const count = 7 + Math.floor(Math.random() * 4);

    const burst: Particle[] = Array.from({ length: count }, () => {
      seq += 1;
      return {
        id: "p" + seq,
        emoji: trigger.emoji,
        left: base + (Math.random() * 14 - 7),
        drift: Math.random() * 140 - 70,
        size: 20 + Math.random() * 22,
        duration: 2200 + Math.random() * 1400,
        delay: Math.random() * 320,
        rotate: Math.random() * 60 - 30,
      };
    });

    setParticles((prev) => [...prev, ...burst]);

    const longest = Math.max(...burst.map((p) => p.duration + p.delay)) + 120;
    const timer = window.setTimeout(() => {
      const ids = new Set(burst.map((b) => b.id));
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, longest);

    return () => window.clearTimeout(timer);
  }, [trigger, originX]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <style>{`
        @keyframes pv-float-up {
          0%   { opacity: 0; transform: translate3d(0, 0, 0) scale(0.4) rotate(0deg); }
          12%  { opacity: 1; transform: translate3d(calc(var(--drift) * 0.15), -10vh, 0) scale(1.15) rotate(calc(var(--rot) * 0.2)); }
          45%  { opacity: 1; transform: translate3d(calc(var(--drift) * 0.6), -42vh, 0) scale(1) rotate(calc(var(--rot) * 0.7)); }
          80%  { opacity: 0.55; transform: translate3d(calc(var(--drift) * 0.9), -68vh, 0) scale(0.92) rotate(var(--rot)); }
          100% { opacity: 0; transform: translate3d(var(--drift), -84vh, 0) scale(0.75) rotate(var(--rot)); }
        }
      `}</style>

      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            bottom: "16%",
            left: p.left + "%",
            fontSize: p.size + "px",
            lineHeight: 1,
            ["--drift" as any]: p.drift + "px",
            ["--rot" as any]: p.rotate + "deg",
            animation: "pv-float-up " + p.duration + "ms cubic-bezier(.22,.61,.36,1) " + p.delay + "ms forwards",
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))",
            willChange: "transform, opacity",
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}