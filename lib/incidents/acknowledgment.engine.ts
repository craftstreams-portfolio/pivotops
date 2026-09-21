export type IncidentAcknowledgment = {
  incidentId: string;
  acknowledgedBy: string;
  acknowledgedAt: number;
};

const acknowledgments =
  new Map<string, IncidentAcknowledgment>();

export function acknowledgeIncident(
  incidentId: string,
  userId: string
) {
  const acknowledgment: IncidentAcknowledgment = {
    incidentId,
    acknowledgedBy: userId,
    acknowledgedAt: Date.now(),
  };

  acknowledgments.set(incidentId, acknowledgment);

  return acknowledgment;
}

export function getIncidentAcknowledgment(
  incidentId: string
) {
  return acknowledgments.get(incidentId) ?? null;
}