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

// List a tenant's connected SHOPLINE stores. Bearer auth. Never returns access_token.
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

  const admin = getAdmin();
  let tenantId: string | null = null;
  const { data: profile } = await admin
    .from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  tenantId = (profile?.tenant_id as string) ?? null;
  if (!tenantId) {
    const { data: owned } = await admin
      .from("tenants").select("id").eq("owner_id", user.id).maybeSingle();
    tenantId = (owned?.id as string) ?? null;
  }
  if (!tenantId) return NextResponse.json({ error: "No tenant." }, { status: 403 });

  const { data, error } = await admin
    .from("shopline_connections")
    .select("handle, store_name, status, scope, installed_at, last_synced_at")
    .eq("tenant_id", tenantId)
    .order("installed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connections: data ?? [] });
}