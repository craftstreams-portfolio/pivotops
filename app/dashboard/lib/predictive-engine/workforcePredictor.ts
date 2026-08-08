import { getLedgerEvents } from "../event-bus/workforceLedger";

export function predictOperationalRisk() {
  const events = getLedgerEvents();

  const sosCount = events.filter(
    (e) => e.type === "SOS_INCIDENT_CREATED"
  ).length;

  const clockOutCount = events.filter(
    (e) => e.type === "CLOCK_OUT"
  ).length;

  const riskScore =
    sosCount * 20 +
    Math.max(0, 10 - clockOutCount);

  return {
    riskScore,
    status:
      riskScore > 70
        ? "critical"
        : riskScore > 40
        ? "high"
        : "stable",
  };
}
