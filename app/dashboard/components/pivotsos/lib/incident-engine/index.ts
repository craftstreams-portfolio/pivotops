export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface Incident {
  id: string;
  title: string;
  description: string;
  reportedBy: string;
  timestamp: number;
  severity: IncidentSeverity;
  status: "open" | "investigating" | "resolved";
}

export function classifyIncident(text: string): IncidentSeverity {
  const lower = text.toLowerCase();

  if (lower.includes("violence") || lower.includes("threat")) return "critical";
  if (lower.includes("conflict") || lower.includes("harassment")) return "high";
  if (lower.includes("issue") || lower.includes("complaint")) return "medium";

  return "low";
}

export function escalateIncident(severity: IncidentSeverity) {
  return {
    routeToHR: severity === "medium" || severity === "high" || severity === "critical",
    routeToSecurity: severity === "critical",
    autoNotifyAdmin: severity === "high" || severity === "critical",
  };
}