export type IncidentSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export const SLA_MINUTES: Record<IncidentSeverity, number> = {
  critical: 5,
  high: 15,
  medium: 60,
  low: 240,
};

export function calculateSLADeadline(
  severity: IncidentSeverity,
  createdAt: number
) {
  const minutes = SLA_MINUTES[severity];

  return createdAt + minutes * 60 * 1000;
}

export function isSLABreached(deadline: number) {
  return Date.now() > deadline;
}

export function getRemainingSLATime(deadline: number) {
  return Math.max(0, deadline - Date.now());
}