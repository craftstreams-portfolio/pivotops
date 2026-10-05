import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * app/api/audit/route.ts
 *
 * Merges the three places audit data lands into one tenant-scoped timeline:
 *
 *   audit_logs             general application events
 *   employee_access_audit  suspend / disable / deactivate / reinstate, with
 *                          IP, user agent, and status transitions
 *   dodo_webhook_events    billing lifecycle from the payment provider
 *
 * Each table has its own shape, so rows are normalised here rather than in
 * the page. Admin-only: an audit trail that every user can read is a
 * different thing from an audit trail.
 */

interface AuditRow {
  id: string;
  source: "application" | "access" | "billing";
  action: string;
  actor: string | null;
  entity: string | null;
  severity: "info" | "warning" | "critical";
  detail: Record<string, unknown>;
  ip: string | null;
  at: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: profile } = await admin.from("profiles")
    .select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can view the audit log." }, { status: 403 });
  }

  const tenantId = profile.tenant_id;
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 30), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows: AuditRow[] = [];

  // ── application events ──
  const { data: appRows } = await admin.from("audit_logs")
    .select("id, action, user_name, user_id, entity_type, entity_id, metadata, severity, ip_address, created_at")
    .eq("tenant_id", tenantId).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(300);

  for (const r of appRows ?? []) {
    rows.push({
      id: r.id, source: "application", action: r.action,
      actor: r.user_name ?? r.user_id ?? null,
      entity: r.entity_type ? `${r.entity_type}${r.entity_id ? ` · ${r.entity_id}` : ""}` : null,
      severity: (r.severity as AuditRow["severity"]) ?? "info",
      detail: (r.metadata as Record<string, unknown>) ?? {},
      ip: r.ip_address ?? null,
      at: r.created_at,
    });
  }

  // ── access control events ──
  const { data: accessRows } = await admin.from("employee_access_audit")
    .select("id, action, event_status, previous_status, new_status, reason, notes, actor_id, employee_id, ip_address, created_at")
    .eq("tenant_id", tenantId).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(300);

  // Resolve actor and subject names in one pass rather than per row.
  const ids = new Set<string>();
  for (const r of accessRows ?? []) {
    if (r.actor_id) ids.add(r.actor_id);
    if (r.employee_id) ids.add(r.employee_id);
  }
  const nameById = new Map<string, string>();
  if (ids.size) {
    const { data: people } = await admin.from("profiles")
      .select("id, full_name, email").in("id", [...ids]);
    for (const p of people ?? []) nameById.set(p.id, p.full_name || p.email || p.id);
  }

  for (const r of accessRows ?? []) {
    rows.push({
      id: r.id, source: "access",
      action: `access.${r.action}${r.event_status === "initiated" ? " (initiated)" : ""}`,
      actor: r.actor_id ? (nameById.get(r.actor_id) ?? r.actor_id) : null,
      entity: r.employee_id ? (nameById.get(r.employee_id) ?? r.employee_id) : null,
      severity: r.new_status === "active" ? "info" : "warning",
      detail: {
        from: r.previous_status, to: r.new_status,
        ...(r.reason ? { reason: r.reason } : {}),
        ...(r.notes ? { notes: r.notes } : {}),
      },
      ip: r.ip_address ?? null,
      at: r.created_at,
    });
  }

  // ── billing events ──
  // dodo_webhook_events is not tenant-scoped in its own columns, so the
  // tenant is read out of the payload metadata set at checkout.
  const { data: billingRows } = await admin.from("dodo_webhook_events")
    .select("webhook_id, event_type, payload, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false }).limit(200);

  for (const r of billingRows ?? []) {
    const payload = (r.payload ?? {}) as any;
    const rowTenant = payload?.data?.metadata?.tenant_id
      ?? payload?.data?.subscription?.metadata?.tenant_id;
    if (rowTenant !== tenantId) continue;
    rows.push({
      id: r.webhook_id, source: "billing", action: `billing.${r.event_type}`,
      actor: null, entity: null,
      severity: /failed|refund|cancel/.test(r.event_type) ? "warning" : "info",
      detail: {
        ...(payload?.data?.metadata?.plan ? { plan: payload.data.metadata.plan } : {}),
        ...(payload?.data?.subscription_id ? { subscription: payload.data.subscription_id } : {}),
      },
      ip: null,
      at: r.created_at,
    });
  }

  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return NextResponse.json({ rows: rows.slice(0, 500) });
}