"use client";

import { useEffect, useState } from "react";

import { runAutonomousSystem } from "../lib/autonomy-controller";

export default function AutonomyPanel() {
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(runAutonomousSystem());
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!state) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-2">
        Autonomous Operations Core
      </h2>

      <p className="text-xs text-zinc-400">
        Action: {state.remediation.action}
      </p>

      <p className="text-xs text-zinc-300 mt-2">
        Result: {state.execution.reason}
      </p>

      <p className="text-xs mt-2 text-emerald-400">
        Cycle: {state.systemStatus}
      </p>
    </div>
  );
}