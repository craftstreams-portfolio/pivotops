import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * app/api/shopify/claim/route.ts
 *
 * Provisions a brand-new tenant for a merchant who installed via Shopify with
 * no existing PivotOps account, then links the shopify_installs row to it.
 *
 * ISOLATION: net-new file. Does NOT call or import app/api/owner/create-tenant
 * - the provisioning steps below are a deliberate standalone duplicate of that
 * route's shape (tenant + settings + score_thresholds + default channels +
 * audit log), confirmed against the live schema rather than guessed, so a
 * Shopify-originated tenant is indistinguishable from any other in the
 * database. Any future change to the owner-signup flow does not affect this
 * file, and any change here cannot affect owner-signup.
 */

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Same transform as app/onboarding/page.tsx:387 - kept as a local duplicate. */
function buildTenantId(orgName: string): string {
  return orgName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) + "-" + Date.now().toString(36);
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { shop, orgName, fullName } = body as { shop?: string; orgName?: string; fullName?: string };

  if (!shop || !orgName) {
    return NextResponse.json({ error: "Missing shop or company name." }, { status: 400 });
  }

  const admin = getAdmin();
  const userId = user.id;
  const userEmail = user.email ?? "";
  const now = new Date().toISOString();

  // The install must exist and not already belong to a tenant - if it does,
  // the merchant should be on /shopify/link instead, not creating a duplicate.
  const { data: install } = await admin
    .from("shopify_installs")
    .select("id, tenant_id")
    .eq("shop", shop)
    .maybeSingle();

  if (!install) {
    return NextResponse.json({ error: "No pending install found for this store. Please reinstall from Shopify." }, { status: 404 });
  }
  if (install.tenant_id) {
    return NextResponse.json({ error: "This store is already connected to a workspace." }, { status: 409 });
  }

  const tid = buildTenantId(orgName);

  // 1) Tenant (fires provision_free_subscription trigger -> 7-day trial, same
  //    as owner-signup, since it is a database trigger not app-layer code).
  const { error: tenantErr } = await admin.from("tenants").insert({
    id: tid, slug: tid, name: orgName, org_name: orgName,
    owner_id: userId, owner_email: userEmail,
    tenant_slug: tid, created_at: now, updated_at: now,
  });
  if (tenantErr) {
    console.error("[shopify/claim] tenant insert failed:", tenantErr);
    return NextResponse.json({ error: "Failed to create workspace: " + tenantErr.message }, { status: 500 });
  }

  // 2) Owner profile - role explicitly "admin". The column default is "user",
  //    which none of the app's role checks recognise; the owner of a brand
  //    new tenant must be admin to reach Settings, Team Invites, etc.
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId, email: userEmail,
    full_name: fullName || userEmail.split("@")[0],
    tenant_id: tid, role: "admin",
    org_name: orgName,
    onboarding_complete: true,
    first_login_at: now, date_joined: now.slice(0, 10),
    updated_at: now,
  }, { onConflict: "id" });
  if (profileErr) {
    console.error("[shopify/claim] profile upsert failed:", profileErr);
    return NextResponse.json({ error: "Failed to set up your profile: " + profileErr.message }, { status: 500 });
  }

  // 3) Settings
  await admin.from("settings").upsert({
    tenant_id: tid, org_name: orgName, updated_at: now,
  }, { onConflict: "tenant_id" });

  // 4) Score thresholds (default row, manager_id null)
  const { data: existingThreshold } = await admin.from("score_thresholds")
    .select("id").eq("tenant_id", tid).is("manager_id", null).maybeSingle();
  if (!existingThreshold) {
    await admin.from("score_thresholds").insert({ tenant_id: tid, manager_id: null });
  }

  // 5) Default channels
  for (const ch of ["candidates", "recruitment-review", "rejected-candidates", "general", "teams-media"]) {
    const { data: existingChannel } = await admin.from("channels")
      .select("id").eq("name", ch).eq("tenant_id", tid).maybeSingle();
    if (!existingChannel) {
      await admin.from("channels").insert({ name: ch, tenant_id: tid, type: "channel", created_by: userId, created_at: now });
    }
  }

  // 6) Audit log
  await admin.from("audit_logs").insert({
    tenant_id: tid, user_id: userId,
    action: "workspace_created", entity_type: "tenant", entity_id: tid,
    metadata: { org_name: orgName, source: "shopify_install", shop },
    created_at: now,
  });

  // 7) Link the install to the new tenant.
  const { error: linkErr } = await admin.from("shopify_installs")
    .update({ tenant_id: tid, claimed_at: now, updated_at: now })
    .eq("id", install.id);
  if (linkErr) {
    console.error("[shopify/claim] failed to link install to tenant (tenant created OK):", linkErr);
    // Don't fail the whole request - the tenant exists and the owner can sign
    // in. The install link can be retried; log loudly so it is caught.
  }

  return NextResponse.json({ ok: true, tenantId: tid });
}