import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createState } from "@/lib/shopline/state";
import { authorizeUrl, shoplineConfigured } from "@/lib/shopline/config";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Entry A: logged-in PivotOps user starts a SHOPLINE connection.
// POST { handle } with Authorization: Bearer <token>. Returns { url } to redirect to.
export async function POST(req: NextRequest) {
  if (!shoplineConfigured()) {
    return NextResponse.json({ error: "SHOPLINE not configured." }, { status: 503 });
  }

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

  const body = await req.json().catch(() => ({}));
  const handle = String(body?.handle ?? "").trim().toLowerCase();
  if (!handle || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(handle)) {
    return NextResponse.json({ error: "Valid handle required." }, { status: 400 });
  }

  // Resolve tenant for this user: profiles.tenant_id, else tenants.owner_id.
  const admin = getAdmin();
  let tenantId: string | null = null;
  const { data: profile, error: pErr } = await admin
    .from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (pErr) console.error("[shopline/connect] profiles lookup:", pErr);
  tenantId = (profile?.tenant_id as string) ?? null;
  if (!tenantId) {
    const { data: owned, error: tErr } = await admin
      .from("tenants").select("id").eq("owner_id", user.id).maybeSingle();
    if (tErr) console.error("[shopline/connect] tenants lookup:", tErr);
    tenantId = (owned?.id as string) ?? null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant for user." }, { status: 403 });
  }

  const state = createState(tenantId, handle);
  return NextResponse.json({ url: authorizeUrl(handle, state) });
}