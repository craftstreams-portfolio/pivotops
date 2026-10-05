import {
  createIncidentAuditLog,
} from "./incident.audit";

import {
  INCIDENT_STATES,
} from "./incident.state-machine";

export type EscalationInput = {
  incidentId: string;
  severity: "critical" | "high" | "medium" | "low";
  department: string;
};

export function escalateIncident(
  input: EscalationInput
) {
  let escalationTarget = "operations";

  if (input.severity === "critical") {
    escalationTarget = "executive-command";
  } else if (input.severity === "high") {
    escalationTarget = "supervisors";
  }

  createIncidentAuditLog({
    id: crypto.randomUUID(),
    incidentId: input.incidentId,
    action: "INCIDENT_ESCALATED",
    timestamp: Date.now(),
    metadata: {
      escalationTarget,
      severity: input.severity,
      state: INCIDENT_STATES.ESCALATED,
    },
  });

  return {
    escalated: true,
    escalationTarget,
    state: INCIDENT_STATES.ESCALATED,
  };
}