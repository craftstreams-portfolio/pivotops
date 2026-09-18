import { getLedgerEvents } from "../../../event-bus/workforceLedger";

export function generateExecutiveSummary() {
  const events = getLedgerEvents();

  const summary = {
    totalEvents: events.length,
    sosIncidents: events.filter(
      (e) => e.type === "SOS_INCIDENT_CREATED"
    ).length,
    clockInRate:
      events.filter((e) => e.type === "CLOCK_IN").length /
      (events.length || 1),
    systemHealth:
      events.length > 50 ? "active-high-load" : "stable",
  };

  return {
    insight:
      summary.sosIncidents > 5
        ? "Operational stress detected across workforce nodes"
        : "Workforce operating within expected parameters",
    metrics: summary,
  };
}
