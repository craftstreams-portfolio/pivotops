"use client";

import { useEffect, useState } from "react";
import { runPredictiveEngine } from "../../lib/predictive-engine/predictive-orchestrator";

export function usePredictiveStream() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // MOCK SIGNALS (replace later with real events)
      const signals = [
        { type: "workflow", severity: Math.random(), timestamp: Date.now() },
        { type: "performance", severity: Math.random(), timestamp: Date.now() },
      ];

      const result = runPredictiveEngine(signals as any);
      setData(result);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return data;
}