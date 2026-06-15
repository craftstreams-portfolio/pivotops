"use client";

import { useEffect, useState } from "react";

export default function SystemHeartbeat() {
  const [status, setStatus] = useState("stable");
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // simulate system variability
      const rand = Math.random();

      if (rand > 0.92) setStatus("degraded");
      else setStatus("stable");

      setPulse((p) => p + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const color =
    status === "stable"
      ? "bg-emerald-500"
      : "bg-yellow-500";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-500">
          System Heartbeat
        </p>

        <h3 className="text-sm font-semibold mt-1">
          {status === "stable"
            ? "All Systems Stable"
            : "Minor Degradation Detected"}
        </h3>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${color} animate-pulse`}
        />

        <span className="text-xs text-zinc-400">
          pulse #{pulse}
        </span>
      </div>
    </div>
  );
}