import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
    // Authenticate via Bearer token WITHOUT requiring an existing tenant
    // (this route creates the user's first tenant, so withSecurity's
    // tenant_id requirement would wrongly reject it).
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const ctx = { userId: user.id, email: user.email ?? "" };

    const body = await req.json();
    const {
      tid, orgName, industry, teamSize, country,
      adminName, departments, autoScore, autoOnboard, geoTag,
      thresholdAI, thresholdMR, applyLinkUrl, shopline_claim,
    } = body;

    if (!tid || !orgName) {
      return NextResponse.json({ error: "Missing organization details." }, { status: 400 });
    }

    const admin   = getAdmin();
    const userId  = ctx.userId;
    const userEmail = ctx.email;
    const now     = new Date().toISOString();

    // 1) Tenant (fires provision_free_subscription trigger -> 7-day trial)
    const { error: tenantErr } = await admin.from("tenants").insert({
      id: tid, slug: tid, name: orgName, org_name: orgName, org_industry: industry,
      org_size: teamSize, org_country: country,
      owner_id: userId, owner_email: userEmail,
      apply_link: applyLinkUrl, tenant_slug: tid,
      created_at: now, updated_at: now,
    });
    if (tenantErr) {
      console.error("[create-tenant] tenant insert", tenantErr);
      return NextResponse.json({ error: "Tenant creation failed: " + tenantErr.message }, { status: 500 });
    }

    // Attach a pending SHOPLINE store to this new tenant (Entry B: SHOPLINE-first install).
    // Non-blocking - a failed claim never breaks signup.
    console.log("[create-tenant] shopline_claim received:", shopline_claim ?? "(none)");
    if (shopline_claim) {
      try {
        const { data: pending } = await admin
          .from("shopline_connections")
          .select("id, handle, claim_expires_at")
          .eq("claim_token", shopline_claim)
          .is("tenant_id", null)
          .maybeSingle();
        console.log("[create-tenant] pending row lookup:", pending ? `found id=${pending.id}` : "NOT FOUND");
        if (pending && (!pending.claim_expires_at || new Date(pending.claim_expires_at) > new Date())) {
          await admin
            .from("shopline_connections")
            .update({
              tenant_id: tid,
              status: "active",
              claim_token: null,
              claim_expires_at: null,
              updated_at: now,
            })
            .eq("id", pending.id);
          console.log("[create-tenant] claimed SHOPLINE store", pending.handle, "for tenant", tid);
        }
      } catch (claimErr) {
        console.error("[create-tenant] SHOPLINE claim failed (non-blocking):", claimErr);
      }
    }

    // Notify founder of new 7-day trial signup (non-blocking - never breaks signup)
    try {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "craftstreams@gmail.com",
        subject: `New PivotOps trial: ${orgName}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px">
          <h2 style="margin:0 0 4px">New 7-day trial started</h2>
          <p style="color:#555;margin:0 0 16px">A new tenant just created a free trial account.</p>
          <table style="border-collapse:collapse;font-size:14px">
            <tr><td style="padding:4px 12px 4px 0;color:#888">Organization</td><td style="font-weight:600">${orgName}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Owner</td><td>${adminName || userEmail} (${userEmail})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Industry</td><td>${industry ?? "-"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Team size</td><td>${teamSize ?? "-"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Country</td><td>${country ?? "-"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Plan</td><td>Free (trialing, 7 days)</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Tenant ID</td><td>${tid}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Signed up</td><td>${now}</td></tr>
          </table>
        </div>`,
      });
    } catch (notifyErr) {
      console.error("[create-tenant] trial notify email failed (non-blocking):", notifyErr);
    }

    // 2) Owner profile
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId, email: userEmail,
      full_name: (adminName || userEmail.split("@")[0]),
      tenant_id: tid, role: "admin",
      org_name: orgName, org_industry: industry,
      org_size: teamSize, org_country: country,
      onboarding_complete: true,
      first_login_at: now, date_joined: now.slice(0, 10),
      updated_at: now,
    }, { onConflict: "id" });
    if (profileErr) {
      console.error("[create-tenant] profile upsert", profileErr);
      return NextResponse.json({ error: "Profile update failed: " + profileErr.message }, { status: 500 });
    }

    // 3) Settings
    await admin.from("settings").upsert({
      tenant_id: tid, org_name: orgName,
      org_departments: departments,
      ai_enabled: autoScore, onboarding_automation: autoOnboard,
      geo_tagging_enabled: geoTag, updated_at: now,
    }, { onConflict: "tenant_id" });

    // 4) Score thresholds (default, manager_id null)
    const { data: ex } = await admin.from("score_thresholds")
      .select("id").eq("tenant_id", tid).is("manager_id", null).maybeSingle();
    if (!ex) {
      await admin.from("score_thresholds").insert({
        tenant_id: tid, manager_id: null,
        auto_interview: thresholdAI, manual_review: thresholdMR,
      });
    }

    // 5) Default channels
    for (const ch of ["candidates", "recruitment-review", "rejected-candidates", "general", "teams-media"]) {
      const { data: ec } = await admin.from("channels")
        .select("id").eq("name", ch).eq("tenant_id", tid).maybeSingle();
      if (!ec) {
        await admin.from("channels").insert({
          name: ch, tenant_id: tid, type: "channel",
          created_by: userId, created_at: now,
        });
      }
    }

    // 6) Audit log
    await admin.from("audit_logs").insert({
      tenant_id: tid, user_id: userId,
      action: "workspace_created", entity_type: "tenant", entity_id: tid,
      metadata: { org_name: orgName, industry, team_size: teamSize },
      created_at: now,
    });

    return NextResponse.json({ ok: true, tenantId: tid });
}