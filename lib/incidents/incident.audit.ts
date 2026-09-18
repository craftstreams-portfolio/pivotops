export type IncidentAuditEvent = {
  id: string;
  incidentId: string;
  action: string;
  actor?: string;
  timestamp: number;
  metadata?: any;
};

const auditLogs: IncidentAuditEvent[] = [];

export function createIncidentAuditLog(
  log: IncidentAuditEvent
) {
  auditLogs.unshift(log);

  return log;
}

export function getIncidentAuditLogs(
  incidentId?: string
) {
  if (!incidentId) {
    return auditLogs;
  }

  return auditLogs.filter(
    (log) => log.incidentId === incidentId
  );
}