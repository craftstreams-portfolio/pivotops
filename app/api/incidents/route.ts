import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { IncidentSchema, IncidentInput } from "@/lib/security/schemas";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { escalateIncident } from "@/lib/incidents/escalation.engine";
import { acknowledgeIncident } from "@/lib/incidents/acknowledgment.engine";
import { assignIncidentResponder } from "@/lib/incidents/responder.engine";
import { isSLABreached } from "@/lib/incidents/sla.engine";
import { canTransitionIncident, type IncidentState } from "@/lib/incidents/incident.state-machine";
function extractMessage(e: unknown): string { if (!e) return "Unknown"; if (typeof e === "string") return e; if (e instanceof Error) return e.message; return JSON.stringify(e); }
const SLA: Record<string, number> = { critical: 5, high: 15, medium: 60, low: 240 };
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? "default";
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  try {
    let q = supabase.from("incidents").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    if (severity) q = q.eq("severity", severity);
    const { data, error } = await q;
    if (error) throw new Error(extractMessage(error));
    const enriched = (data ?? []).map((inc: Record<string, unknown>) => ({ ...inc, sla_breached: inc.sla_deadline ? isSLABreached(new Date(inc.sla_deadline as string).getTime()) : false }));
    return NextResponse.json({ success: true, incidents: enriched, count: enriched.length });
  } catch (e) { logger.error("GET /api/incidents failed", { error: extractMessage(e) }); return NextResponse.json({ error: "Failed to fetch incidents." }, { status: 500 }); }
}
export const POST = withSecurity<IncidentInput>(
  async (_req, { auth, body }) => {
    const tenantId = body.tenantId ?? auth?.tenantId ?? "default";
    if (body.action === "create") {
      const { title, description, severity = "medium", category, affectedArea, reporterId, reporterName } = body;
      const slaMinutes = SLA[severity] ?? 60;
      const slaDeadline = new Date(Date.now() + slaMinutes * 60000).toISOString();
      const { data, error } = await supabase.from("incidents").insert({ tenant_id: tenantId, title, description: description ?? null, severity, status: "OPEN", category: category ?? null, affected_area: affectedArea ?? null, reporter_id: reporterId ?? auth?.userId ?? null, reporter_name: reporterName ?? auth?.email ?? null, sla_deadline: slaDeadline, sla_breached: false, auto_healed: false, priority: severity === "critical" ? 1 : severity === "high" ? 2 : severity === "medium" ? 3 : 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
      if (error) throw new Error(extractMessage(error));
      await supabase.from("incident_updates").insert({ incident_id: data.id, tenant_id: tenantId, message: `Incident created: ${title}. Severity: ${severity.toUpperCase()}. SLA: ${slaMinutes}min.`, author: reporterName ?? auth?.email ?? "System", author_id: reporterId ?? auth?.userId ?? null, type: "update", created_at: new Date().toISOString() });
      await supabase.from("xavier_notifications").insert({ tenant_id: tenantId, candidate_id: null, stage: "auto_reject", message: `PivotSOS - New ${severity.toUpperCase()} incident: "${title}" - SLA: ${slaMinutes}min`, type: severity === "critical" || severity === "high" ? "alert" : "warning", read: false, created_at: new Date().toISOString() });
      logger.info("Incident created", { incidentId: data.id, severity, tenantId });
      return NextResponse.json({ success: true, incident: data });
    }
    if (body.action === "acknowledge") {
      const { incidentId, userId, userName } = body; acknowledgeIncident(incidentId, userId);
      const { error } = await supabase.from("incidents").update({ status: "ACKNOWLEDGED", acknowledged_by: userName ?? userId, acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", incidentId).eq("tenant_id", tenantId);
      if (error) throw new Error(extractMessage(error));
      await supabase.from("incident_updates").insert({ incident_id: incidentId, tenant_id: tenantId, message: `Acknowledged by ${userName ?? userId}`, author: userName ?? userId, author_id: userId, type: "ack", created_at: new Date().toISOString() });
      return NextResponse.json({ success: true, action: "acknowledged" });
    }
    if (body.action === "escalate") {
      const { incidentId, severity = "high", department = "operations", escalatedBy } = body;
      const result = escalateIncident({ incidentId, severity, department });
      await supabase.from("incidents").update({ status: "ESCALATED", escalated_to: result.escalationTarget, escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", incidentId).eq("tenant_id", tenantId);
      await supabase.from("incident_updates").insert({ incident_id: incidentId, tenant_id: tenantId, message: `Escalated to ${result.escalationTarget} by ${escalatedBy ?? auth?.email ?? "System"}`, author: escalatedBy ?? auth?.email ?? "System", type: "escalation", created_at: new Date().toISOString() });
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "transition") {
      const { incidentId, nextState, updatedBy } = body;
      const { data: inc } = await supabase.from("incidents").select("status").eq("id", incidentId).eq("tenant_id", tenantId).single();
      if (!inc) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
      const currentState = inc.status as IncidentState; const newState = nextState as IncidentState;
      if (!canTransitionIncident(currentState, newState)) return NextResponse.json({ error: `Invalid transition: ${currentState} to ${newState}` }, { status: 400 });
      const updates: Record<string, unknown> = { status: newState, updated_at: new Date().toISOString() };
      if (newState === "RESOLVED") updates.resolved_at = new Date().toISOString();
      await supabase.from("incidents").update(updates).eq("id", incidentId).eq("tenant_id", tenantId);
      await supabase.from("incident_updates").insert({ incident_id: incidentId, tenant_id: tenantId, message: `Status: ${currentState} to ${newState} by ${updatedBy ?? auth?.email ?? "System"}`, author: updatedBy ?? auth?.email ?? "System", type: newState === "RESOLVED" ? "resolution" : "update", created_at: new Date().toISOString() });
      return NextResponse.json({ success: true, from: currentState, to: newState });
    }
    if (body.action === "assign") {
      const { incidentId, responderId, responderName, department } = body;
      assignIncidentResponder(incidentId, responderId, department ?? "operations");
      await supabase.from("incidents").update({ assigned_to: responderName ?? responderId, status: "IN_PROGRESS", updated_at: new Date().toISOString() }).eq("id", incidentId).eq("tenant_id", tenantId);
      await supabase.from("incident_updates").insert({ incident_id: incidentId, tenant_id: tenantId, message: `Assigned to ${responderName ?? responderId} (${department ?? "operations"})`, author: "System", type: "update", created_at: new Date().toISOString() });
      return NextResponse.json({ success: true, action: "assigned", responder: responderName ?? responderId });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  },
  { schema: IncidentSchema, rateLimit: RATE_LIMITS.authenticated, requireAuth: true }
);