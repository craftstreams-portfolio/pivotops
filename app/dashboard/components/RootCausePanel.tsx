"use client";

import { useEffect, useState } from "react";

import { runRootCauseAnalysis } from "../lib/intelligence-runner";

export default function RootCausePanel() {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnalysis(runRootCauseAnalysis());
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!analysis) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-2">
        Root Cause Intelligence
      </h2>

      <p className="text-xs text-zinc-400">
        Pattern: {analysis.pattern}
      </p>

      <p className="text-xs text-zinc-300 mt-2">
        Cause: {analysis.probableCause}
      </p>

      <p className="text-xs mt-2 text-red-400">
        Severity: {analysis.severity.toUpperCase()}
      </p>
    </div>
  );
}