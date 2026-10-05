// lib/auth/employeeAccess.ts
//
// Centralized authorization for employee access-control actions.
// Every check happens server-side against database truth — never trust
// a role or tenant ID supplied by the client.

import { createClient } from "@supabase/supabase-js";

export type EmployeeStatus = "active" | "disabled" | "suspended" | "deactivated";

export interface ActorContext {
  userId:   string;
  tenantId: string;
  role:     string;
}

export interface TargetEmployee {
  id:        string;
  tenant_id: string;
  role:      string;
  status:    EmployeeStatus;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Resolves the authenticated actor's identity + tenant + role from their
 * bearer token. Tenant is ALWAYS derived from the server-side profile row,
 * never from anything the client sends — this is what prevents cross-tenant
 * IDOR via a manipulated tenantId in the request body.
 */
export async function resolveActor(req: Request): Promise<ActorContext | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;

  const admin = getAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) return null;
  return { userId: user.id, tenantId: profile.tenant_id, role: profile.role ?? "employee" };
}

/** Fetches the target employee, scoped to the actor's own tenant only. */
export async function loadTargetInTenant(
  employeeId: string,
  tenantId: string
): Promise<TargetEmployee | null> {
  const admin = getAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id, tenant_id, role, status")
    .eq("id", employeeId)
    .eq("tenant_id", tenantId)   // cross-tenant IDOR guard — the WHERE clause itself
    .maybeSingle();
  return (data as TargetEmployee) ?? null;
}

const PRIVILEGED_ROLES = ["owner", "admin"];

export function canManageEmployeeAccess(actor: ActorContext): boolean {
  return PRIVILEGED_ROLES.includes(actor.role);
}

export function canSuspendEmployee(actor: ActorContext, target: TargetEmployee): boolean {
  if (!canManageEmployeeAccess(actor)) return false;
  if (actor.userId === target.id) return false; // no self-suspension
  return true;
}

export function canDisableEmployee(actor: ActorContext, target: TargetEmployee): boolean {
  if (!canManageEmployeeAccess(actor)) return false;
  if (actor.userId === target.id) return false;
  return true;
}

export function canDeactivateEmployee(actor: ActorContext, target: TargetEmployee): boolean {
  if (!canManageEmployeeAccess(actor)) return false;
  if (actor.userId === target.id) return false; // no self-deactivation
  return true;
}

export function canRestoreEmployee(actor: ActorContext, target: TargetEmployee): boolean {
  return canManageEmployeeAccess(actor);
}

export function canRevokeSessions(actor: ActorContext, target: TargetEmployee): boolean {
  return canManageEmployeeAccess(actor);
}

export function canViewAuditHistory(actor: ActorContext): boolean {
  return canManageEmployeeAccess(actor);
}

/**
 * Blocks removing the last owner/admin in a tenant. Without this, a tenant
 * could be locked out entirely (no one left who can manage access).
 */
export async function wouldRemoveLastOwner(
  tenantId: string,
  targetId: string,
  targetRole: string
): Promise<boolean> {
  if (!PRIVILEGED_ROLES.includes(targetRole)) return false;

  const admin = getAdmin();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("role", PRIVILEGED_ROLES)
    .neq("status", "deactivated")
    .neq("id", targetId);

  return (count ?? 0) === 0;
}

/** Valid state transitions — rejects nonsensical jumps like deactivated -> active via a generic toggle. */
const VALID_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  active:      ["disabled", "suspended", "deactivated"],
  disabled:    ["active", "deactivated"],
  suspended:   ["active", "deactivated"],
  deactivated: [], // requires an explicit, separate restore workflow
};

export function isValidTransition(from: EmployeeStatus, to: EmployeeStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
