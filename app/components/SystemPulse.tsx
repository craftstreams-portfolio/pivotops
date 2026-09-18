"use client";

import { useEffect, useState } from "react";

export default function SystemPulse() {
  const [load, setLoad] = useState(42);
  const [status, setStatus] = useState("stable");

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Math.floor(Math.random() * 100);

      setLoad(next);

      if (next > 85) setStatus("degraded");
      else if (next > 60) setStatus("unstable");
      else setStatus("stable");
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const color =
    status === "stable"
      ? "text-emerald-400"
      : status === "unstable"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-2">
        System Load Pulse
      </h2>

      <p className={`text-2xl font-bold ${color}`}>
        {load}% {status}
      </p>

      <div className="w-full h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${load}%` }}
        />
      </div>
    </div>
  );
}