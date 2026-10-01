import { classifyIncident, escalateIncident } from "./lib/incident-engine";

export function evaluateSOSRisk(text: string) {
  const severity = classifyIncident(text);
  const routing = escalateIncident(severity);

  return {
    severity,
    routing,
    score:
      severity === "critical" ? 100 :
      severity === "high" ? 75 :
      severity === "medium" ? 50 : 20,
  };
}