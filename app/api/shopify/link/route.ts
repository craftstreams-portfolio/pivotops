import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * app/api/shopify/link/route.ts
 *
 * Links a Shopify install to the CURRENTLY SIGNED-IN user's existing tenant.
 * Only ever called after the merchant explicitly clicks "Link" on
 * /shopify/link - never auto-links. Requires the signed-in user to already
 * have a tenant_id; does not create one.
 *
 * ISOLATION: net-new file. Does not import from app/api/owner/create-tenant,
 * app/api/shopline/, or app/onboarding/.
 */

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
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
  const { shop } = body as { shop?: string };
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter." }, { status: 400 });
  }

  const admin = getAdmin();

  // Only admins link stores - same bar as inviting teammates or changing
  // billing, since this attaches an external data source to the workspace.
  const { data: profile } = await admin.from("profiles")
    .select("tenant_id, role").eq("id", user.id).maybeSingle();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No workspace found for your account." }, { status: 404 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can connect a Shopify store." }, { status: 403 });
  }

  const { data: install } = await admin.from("shopify_installs")
    .select("id, tenant_id").eq("shop", shop).maybeSingle();

  if (!install) {
    return NextResponse.json({ error: "No pending install found for this store. Please reinstall from Shopify." }, { status: 404 });
  }
  if (install.tenant_id && install.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "This store is already connected to a different workspace." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: linkErr } = await admin.from("shopify_installs")
    .update({ tenant_id: profile.tenant_id, claimed_at: now, updated_at: now })
    .eq("id", install.id);

  if (linkErr) {
    console.error("[shopify/link] failed to link install:", linkErr);
    return NextResponse.json({ error: "Failed to link store: " + linkErr.message }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    tenant_id: profile.tenant_id, user_id: user.id,
    action: "shopify_store_linked", entity_type: "shopify_install", entity_id: install.id,
    metadata: { shop }, created_at: now,
  });

  return NextResponse.json({ ok: true });
}