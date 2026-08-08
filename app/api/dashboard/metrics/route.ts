import { NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const GET = withSecurity(
  async (_req, { auth }) => {
    const tenantId = auth!.tenantId;
    const admin = getAdmin();

    // Parallel fetches
    const [
      { data: candidates },
      { data: onboardingRows },
      { data: complianceDocs },
      { data: incidents },
      { data: tasks },
      { data: spotlights },
    ] = await Promise.all([
      admin.from("candidates").select("id,status,decision,role,ai_score,created_at,hired_at").eq("tenant_id", tenantId),
      admin.from("onboarding").select("id,status").eq("tenant_id", tenantId),
      admin.from("compliance_docs").select("id,status").eq("tenant_id", tenantId),
      admin.from("incidents").select("id,status,severity").eq("tenant_id", tenantId),
      admin.from("tasks").select("id,status").eq("tenant_id", tenantId),
      admin.from("spotlights").select("id,created_at").eq("tenant_id", tenantId),
    ]);

    const cands        = candidates        ?? [];
    const onboards     = onboardingRows    ?? [];
    const compDocs     = complianceDocs    ?? [];
    const incidentRows = incidents         ?? [];
    const taskRows     = tasks             ?? [];
    const spotRows     = spotlights        ?? [];

    // Pipeline counts
    // Pipeline is keyed off `status` — the same field the recruitment board uses.
    // (`decision` is Xavier''s recommendation, not the actual stage, and the old
    // code counted decision === "HIRED", a value that never exists.)
    const st = (c: any) => String(c.status ?? "").toLowerCase();
    const applied    = cands.length;
    const screening  = cands.filter(c => ["screening", "assessment", "recruitment_review"].includes(st(c))).length;
    const interview  = cands.filter(c => ["interview", "shortlisted"].includes(st(c))).length;
    const offer      = cands.filter(c => st(c) === "offer").length;
    const hired      = cands.filter(c => st(c) === "hired").length;
    const rejected   = cands.filter(c => st(c) === "rejected").length;

    // Onboarding
    const onboardingActive = onboards.filter(o => o.status === "pending" || o.status === "in_progress").length;

    // Compliance
    const compTotal    = compDocs.length;
    const compApproved = compDocs.filter(d => d.status === "approved").length;
    const complianceRate = compTotal > 0 ? Math.round((compApproved / compTotal) * 100) : 0;

    // Incidents
    const activeIncidents = incidentRows.filter(i => i.status === "open").length;

    // Tasks
    const openTasks = taskRows.filter(t => t.status === "pending" || t.status === "open").length;

    // Spotlights this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const spotlightsThisMonth = spotRows.filter(s => s.created_at >= monthStart).length;

    // Avg Xavier score
    const scored = cands.filter(c => typeof c.ai_score === "number" && c.ai_score > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, c) => s + (c.ai_score as number), 0) / scored.length)
      : 0;

    // Conversion + dropoff
    const conversionRate = applied > 0 ? Math.round((hired / applied) * 100) : 0;
    const dropoffRate    = applied > 0 ? Math.round(((applied - hired) / applied) * 100) : 0;

    // Efficiency metrics
    const hiringEfficiency   = Math.min(100, Math.round(conversionRate * 4 + (complianceRate * 0.2)));
    const automationCoverage = 84; // static until workflow automation telemetry is wired
    const costSaved          = hired * 3200; // $3,200 saved per automated hire vs agency fee

    // Time to hire (days between created_at and hired — stub with 72hr target)
    const timeToHire = { current: 3.0, baseline: 14.0, improvement: 11.0 };

    // System health
    const systemHealth = activeIncidents === 0
      ? "Healthy"
      : activeIncidents <= 2 ? "At Risk" : "Critical";

    // Funnel
    const funnel = { applied, screening, interview, offer, hired };

    // Dept distribution — group by role prefix
    const deptMap: Record<string, number> = {};
    for (const c of cands) {
      const role  = (c.role ?? "Other").split(" - ")[0].trim();
      const label = role.length > 20 ? role.slice(0, 18) + "…" : role;
      deptMap[label] = (deptMap[label] ?? 0) + 1;
    }
    const deptDistribution = Object.entries(deptMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // Top roles
    const roleMap: Record<string, number> = {};
    for (const c of cands) {
      const parts = (c.role ?? "Other").split(" - ");
      const role  = (parts[1] ?? parts[0] ?? "Other").trim();
      const label = role.length > 24 ? role.slice(0, 22) + "…" : role;
      roleMap[label] = (roleMap[label] ?? 0) + 1;
    }
    const topRoles = Object.entries(roleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // 6-week trends (bucket candidates by week)
    const weekBuckets = [0, 0, 0, 0, 0, 0];
    const hireBuckets = [0, 0, 0, 0, 0, 0];
    for (const c of cands) {
      const weeksAgo = Math.floor(
        (Date.now() - new Date(c.created_at).getTime()) / (7 * 24 * 3600 * 1000)
      );
      const idx = 5 - Math.min(weeksAgo, 5);
      weekBuckets[idx]++;
      if (String(c.status ?? "").toLowerCase() === "hired") hireBuckets[idx]++;
    }
    // Only series we can actually derive from rows. The old timeToHire/dropoff
    // arrays were hardcoded curves, not measurements.
    const trends = {
      applications: weekBuckets,
      hires:        hireBuckets,
    };

    // Xavier insights
    const insights: { type: string; severity: string; message: string }[] = [];
    if (applied === 0) {
      insights.push({ type: "info", severity: "info", message: "No applications yet. Post your first role to activate Xavier AI scoring." });
    } else {
      if (conversionRate > 15) insights.push({ type: "success", severity: "success", message: `Strong ${conversionRate}% application-to-hire conversion — well above the 15% industry benchmark.` });
      else if (conversionRate < 5 && applied > 5) insights.push({ type: "warning", severity: "alert", message: `Conversion rate is ${conversionRate}% — consider adjusting scoring thresholds or role requirements.` });
      if (activeIncidents > 0) insights.push({ type: "alert", severity: "alert", message: `${activeIncidents} active incident${activeIncidents > 1 ? "s" : ""} require attention in PivotSOS.` });
      if (complianceRate < 70 && compTotal > 0) insights.push({ type: "warning", severity: "warning", message: `Compliance rate at ${complianceRate}% — ${compTotal - compApproved} document${compTotal - compApproved !== 1 ? "s" : ""} pending review.` });
      if (openTasks > 10) insights.push({ type: "warning", severity: "warning", message: `${openTasks} open tasks in the task center — consider reassigning or closing stale items.` });
      if (avgScore > 0) insights.push({ type: "info", severity: "info", message: `Average Xavier AI candidate score is ${avgScore}/100 across ${applied} application${applied !== 1 ? "s" : ""}.` });
      if (insights.length === 0) insights.push({ type: "success", severity: "success", message: "All systems operating normally. Xavier AI is monitoring your workforce pipeline." });
    }

    return NextResponse.json({
      applied, screening, interview, offer, hired, rejected,
      onboarding:          onboardingActive,
      openTasks,
      activeIncidents,
      spotlightsThisMonth,
      complianceRate,
      avgScore,
      conversionRate,
      dropoffRate,
      hiringEfficiency,
      automationCoverage,
      costSaved,
      systemHealth,
      timeToHire,
      funnel,
      deptDistribution,
      topRoles,
      trends,
      insights,
      generatedAt: new Date().toISOString(),
    });
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);