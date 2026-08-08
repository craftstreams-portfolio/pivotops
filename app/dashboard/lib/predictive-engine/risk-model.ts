import { SystemSignal } from "./signal-collector";

export function calculateSystemRisk(signals: SystemSignal[]) {
  if (!signals.length) return 0;

  const weight =
    signals.reduce((acc, s) => acc + s.severity, 0) /
    signals.length;

  const densityFactor = Math.min(signals.length / 10, 1);

  const riskScore = weight * 0.7 + densityFactor * 0.3;

  return Math.min(riskScore, 1);
}