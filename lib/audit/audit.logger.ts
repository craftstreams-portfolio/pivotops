/**
 * lib/audit/audit.logger.ts
 *
 * Was an in-memory array that never reached the database. Re-exports the
 * real writer so any remaining import gets working behaviour rather than a
 * silent no-op.
 */
export { logAudit, auditIp } from "@/lib/audit";
export type { AuditAction, AuditInput, AuditSeverity } from "@/lib/audit";