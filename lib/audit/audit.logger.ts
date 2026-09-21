export type AuditEvent = {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

const auditLog: AuditEvent[] = [];

export function logAudit(event: AuditEvent) {
  auditLog.push({
    ...event,
    timestamp: new Date().toISOString(),
  });

  console.log("🧾 AUDIT:", event.action, event.entityId);
}

export function getAuditLog() {
  return auditLog;
}