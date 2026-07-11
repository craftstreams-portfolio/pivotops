import { NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { getAdmin } from "@/lib/supabase-admin";
import { buildPerformanceBreakdown } from "@/lib/spotlight/performance";
import { z } from "zod";
const SpotlightActionSchema = z.object({ spotlightId: z.string().uuid(), action: z.enum(["approve","reject"]), managerName: z.string().max(255).optional(), analysis: z.string().max(2000).optional(), rejectionReason: z.string().max(1000).optional() });
type SpotlightActionInput = z.infer<typeof SpotlightActionSchema>;
async function postToTeamsMedia(content: string, tenantId: string, meta?: Record<string, unknown>) {
  await getAdmin().from("messages").insert({ channel_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", content, user_id: "00000000-0000-0000-0000-000000000000", user_name: "PivotOps Spotlight", tenant_id: tenantId, type: "system", retracted: false, reactions: {}, meta: meta ?? null, created_at: new Date().toISOString() });
}
export const POST = withSecurity<SpotlightActionInput>(
  async (_req, { auth, body }) => {
    const { spotlightId, action, managerName, analysis, rejectionReason } = body;
    const { data: spotlight, error: spErr } = await getAdmin().from("spotlights").select("*").eq("id", spotlightId).eq("tenant_id", auth!.tenantId).single();
    if (spErr || !spotlight) return NextResponse.json({ error: "Spotlight not found." }, { status: 404 });
    const tenantId = auth!.tenantId;
    const managerId = auth!.userId;
    const managerLabel = managerName ?? auth!.email;
    const now = new Date().toISOString();
    if (action === "approve") {
      const today = new Date(); const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1, 5, 0, 0, 0); const revealAt = nextMonth.toISOString();
      const { data: profile } = await getAdmin().from("profiles").select("avatar_url").eq("id", spotlight.user_id ?? "").single();
      let performance = null;
      if (spotlight.user_id) {
        try {
          const month = new Date().toISOString().slice(0, 7);
          performance = await buildPerformanceBreakdown(getAdmin(), spotlight.user_id, tenantId, month);
        } catch (e) { console.error("[spotlight] performance breakdown failed", e); }
      }
      const mergedMeta = { ...(spotlight.metadata ?? {}), performance };
      await getAdmin().from("spotlights").update({ approval_status: "approved", approved_by: managerLabel, approved_at: now, analysis: analysis ?? null, metadata: mergedMeta, is_spotlight_of_month: true, reveal_at: revealAt, spotlight_month: nextMonth.toISOString().slice(0, 10), updated_at: now }).eq("id", spotlightId);
      await getAdmin().from("spotlight_of_month").insert({ tenant_id: tenantId, spotlight_id: spotlightId, employee_name: spotlight.created_by, avatar_url: profile?.avatar_url ?? null, month: nextMonth.toISOString().slice(0, 10), approved_by: managerLabel, created_at: now });
      const monthLabel = nextMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
      await postToTeamsMedia(`Spotlight of the Month - ${monthLabel} - ${spotlight.created_by} selected. Approved by ${managerLabel}.`, tenantId, { type: "spotlight_approved", spotlight_id: spotlightId, reveal_at: revealAt });
      return NextResponse.json({ success: true, action: "approved", revealAt });
    }
    await getAdmin().from("spotlights").update({ approval_status: "rejected", approved_by: managerLabel, approved_at: now, rejection_reason: rejectionReason ?? null, is_spotlight_of_month: false, updated_at: now }).eq("id", spotlightId);
    await postToTeamsMedia(`Spotlight review: ${spotlight.created_by} not selected. Reviewed by ${managerLabel}.`, tenantId, { type: "spotlight_rejected", spotlight_id: spotlightId });
    return NextResponse.json({ success: true, action: "rejected" });
  },
  { schema: SpotlightActionSchema, requireAuth: true, requireRole: ["admin","manager","operator"], rateLimit: RATE_LIMITS.authenticated }
);