import { SystemSignal } from "./signal-collector";

export function forecastHealth(signals: SystemSignal[]) {
  const recent = signals.slice(-10);

  const avg =
    recent.reduce((a, b) => a + b.severity, 0) /
    (recent.length || 1);

  return {
    next5minRisk: Math.min(avg * 1.2, 1),
    trend: avg > 0.6 ? "degrading" : "stable",
  };
}