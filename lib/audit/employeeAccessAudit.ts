// lib/audit/employeeAccessAudit.ts
//
// Append-only audit logger for employee access-control actions.
// Records INITIATED before the operation runs, then COMPLETED or FAILED
// after — so an interrupted operation still leaves a trustworthy trail.

import { createClient } from "@supabase/supabase-js";
import type { EmployeeStatus } from "@/lib/auth/employeeAccess";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface AuditParams {
  tenantId:        string;
  employeeId:      string;
  actorId:         string;
  action:          string;
  previousStatus?: EmployeeStatus | null;
  newStatus?:      EmployeeStatus | null;
  reason?:         string | null;
  notes?:          string | null;
  metadata?:       Record<string, unknown>;
  ipAddress?:      string | null;
  userAgent?:      string | null;
}

async function insertAuditRow(params: AuditParams, eventStatus: "initiated" | "completed" | "failed" | "cancelled") {
  const admin = getAdmin();
  const { error } = await admin.from("employee_access_audit").insert({
    tenant_id:       params.tenantId,
    employee_id:     params.employeeId,
    actor_id:        params.actorId,
    action:          params.action,
    event_status:    eventStatus,
    previous_status: params.previousStatus ?? null,
    new_status:      params.newStatus ?? null,
    reason:          params.reason ?? null,
    notes:           params.notes ?? null,
    metadata:        params.metadata ?? {},
    ip_address:      params.ipAddress ?? null,
    user_agent:      params.userAgent ?? null,
  });
  if (error) {
    // Audit logging must never silently vanish — surface it in server logs
    // even though we don't want a logging failure to block the actual action.
    console.error("[employeeAccessAudit] insert failed:", error.message, { action: params.action });
  }
}

export function logInitiated(params: AuditParams) {
  return insertAuditRow(params, "initiated");
}
export function logCompleted(params: AuditParams) {
  return insertAuditRow(params, "completed");
}
export function logFailed(params: AuditParams) {
  return insertAuditRow(params, "failed");
}
export function logCancelled(params: AuditParams) {
  return insertAuditRow(params, "cancelled");
}

/** Fetches an employee's full access/security history, newest first. */
export async function getAccessHistory(tenantId: string, employeeId: string, limit = 50) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("employee_access_audit")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getAccessHistory] failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** Pulls request metadata worth recording without exposing sensitive auth internals. */
export function extractRequestMeta(req: Request) {
  return {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}
