export type IncidentResponder = {
  incidentId: string;
  responderId: string;
  department: string;
  assignedAt: number;
};

const responderAssignments =
  new Map<string, IncidentResponder>();

export function assignIncidentResponder(
  incidentId: string,
  responderId: string,
  department: string
) {
  const assignment: IncidentResponder = {
    incidentId,
    responderId,
    department,
    assignedAt: Date.now(),
  };

  responderAssignments.set(incidentId, assignment);

  return assignment;
}

export function getIncidentResponder(
  incidentId: string
) {
  return responderAssignments.get(incidentId) ?? null;
}