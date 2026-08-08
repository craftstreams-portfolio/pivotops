export const INCIDENT_STATES = {
  OPEN: "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  IN_PROGRESS: "IN_PROGRESS",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  FAILED: "FAILED",
} as const;

export type IncidentState =
  (typeof INCIDENT_STATES)[keyof typeof INCIDENT_STATES];

const VALID_TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  OPEN: ["ACKNOWLEDGED", "ESCALATED", "FAILED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "ESCALATED", "FAILED"],
  IN_PROGRESS: ["RESOLVED", "ESCALATED", "FAILED"],
  ESCALATED: ["IN_PROGRESS", "RESOLVED", "FAILED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
  FAILED: [],
};

export function canTransitionIncident(
  current: IncidentState,
  next: IncidentState
) {
  return VALID_TRANSITIONS[current]?.includes(next);
}

export function transitionIncidentState(
  current: IncidentState,
  next: IncidentState
): IncidentState {
  if (!canTransitionIncident(current, next)) {
    throw new Error(
      `Invalid incident transition: ${current} -> ${next}`
    );
  }

  return next;
}