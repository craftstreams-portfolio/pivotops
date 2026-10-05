import { createClient } from "@supabase/supabase-js";

/**
 * lib/audit.ts
 *
 * Writes to audit_logs. The previous version wrote actor_name/actor_id into
 * a table whose columns are user_name/user_id, and never set tenant_id - so
 * every call through it silently produced nothing. The only rows that ever
 * landed came from direct inserts elsewhere. Column names here match the
 * live schema exactly.
 *
 * Fire-and-forget by design: a failed audit write must never break the
 * action being audited. Failures are logged to the server console.
 */

export type AuditSeverity = "info" | "warning" | "critical";

export type AuditAction =
  // Auth
  | "auth.signin" | "auth.signout" | "auth.signin_failed"
  | "auth.password_reset_requested" | "auth.email_verified"
  // Access control
  | "access.invite_sent" | "access.invite_accepted" | "access.invite_revoked"
  | "access.role_changed" | "access.member_removed" | "access.host_transferred"
  // Tenant lifecycle
  | "tenant.created" | "tenant.settings_changed" | "tenant.deleted"
  // Billing
  | "billing.plan_changed" | "billing.subscription_created"
  | "billing.subscription_cancelled" | "billing.payment_failed"
  // Integrations
  | "integration.connected" | "integration.disconnected" | "integration.oauth_granted"
  // Workforce
  | "workforce.clock_in" | "workforce.clock_out" | "workforce.break_start"
  | "workforce.break_end" | "workforce.overtime_logged" | "workforce.schedule_changed"
  // Recruitment
  | "recruitment.stage_changed" | "recruitment.interview_scheduled"
  | "recruitment.offer_sent" | "recruitment.candidate_declined"
  | "recruitment.onboarding_started" | "recruitment.ai_scored"
  // Compliance
  | "compliance.document_sent" | "compliance.document_signed"
  | "compliance.document_rejected"
  // Communication
  | "huddle.started" | "huddle.ended" | "conference.started" | "conference.ended"
  // Destructive / data
  | "data.deleted" | "data.exported";

export interface AuditInput {
  tenantId: string;
  action: AuditAction;
  userId?: string | null;
  userName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
  ipAddress?: string | null;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Actions that should default to a higher severity when none is given. */
const ELEVATED: Partial<Record<AuditAction, AuditSeverity>> = {
  "auth.signin_failed":           "warning",
  "access.role_changed":          "warning",
  "access.member_removed":        "warning",
  "access.host_transferred":      "warning",
  "billing.payment_failed":       "warning",
  "integration.disconnected":     "warning",
  "tenant.deleted":               "critical",
  "data.deleted":                 "critical",
  "data.exported":                "critical",
};

export async function logAudit(input: AuditInput): Promise<void> {
  if (!input.tenantId) {
    console.error("[audit] refused: tenantId is required", input.action);
    return;
  }
  try {
    const admin = getAdmin();
    const { error } = await admin.from("audit_logs").insert({
      tenant_id:   input.tenantId,
      action:      input.action,
      user_id:     input.userId ?? null,
      user_name:   input.userName ?? null,
      entity_type: input.entityType ?? null,
      entity_id:   input.entityId ?? null,
      metadata:    input.metadata ?? {},
      severity:    input.severity ?? ELEVATED[input.action] ?? "info",
      ip_address:  input.ipAddress ?? null,
    });
    if (error) console.error("[audit] insert failed:", input.action, error.message);
  } catch (err) {
    console.error("[audit] threw:", input.action, err);
  }
}

/** Pulls the caller IP from a request, for routes that have one. */
export function auditIp(req: { headers: { get(name: string): string | null } }): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? null;
}