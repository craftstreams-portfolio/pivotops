import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * app/api/shopify/connections/route.ts
 *
 * Lists the Shopify stores linked to the caller's tenant, for display on
 * Settings > Integrations. Read-only - connections are created by the OAuth
 * install flow, not from this page.
 *
 * ISOLATION: net-new, no imports from app/api/shopline/*.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ connections: [] });

  const { data } = await admin
    .from("shopify_installs")
    .select("id, shop, scope, installed_at, claimed_at, uninstalled_at")
    .eq("tenant_id", profile.tenant_id)
    .order("installed_at", { ascending: false });

  return NextResponse.json({ connections: data ?? [] });
}