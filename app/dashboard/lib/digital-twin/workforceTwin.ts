import { getLedgerEvents } from "../event-bus/workforceLedger";

export function simulateFutureState(hoursAhead: number = 6) {
  const events = getLedgerEvents();

  const baseSOS = events.filter(
    (e) => e.type === "SOS_INCIDENT_CREATED"
  ).length;

  const projectedSOS = baseSOS + Math.floor(hoursAhead * 0.8);

  const projectedRisk =
    projectedSOS > 10 ? "critical" : projectedSOS > 5 ? "high" : "stable";

  return {
    horizon: `${hoursAhead}h`,
    projectedSOS,
    projectedRisk,
    recommendation:
      projectedRisk === "critical"
        ? "Trigger workforce reinforcement protocol"
        : "System stable under projected load",
  };
}
