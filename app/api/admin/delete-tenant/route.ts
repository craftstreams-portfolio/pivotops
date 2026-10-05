import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const token    = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  if (req.nextUrl.searchParams.get("token")) console.warn("[admin] token via query param (deprecated)");
  const tenantId = req.nextUrl.searchParams.get("tenantId");

  if (token !== process.env.ADMIN_SECRET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  // Delete in dependency order
  const tables = [
    "subscriptions","event_logs","xavier_notifications",
    "notifications","candidates","candidate_accounts",
    "profiles","tenants",
  ];

  for (const table of tables) {
    const col = table === "tenants" ? "id" : "tenant_id";
    const { error } = await admin.from(table).delete().eq(col, tenantId);
    if (error) console.error(`Delete ${table} failed:`, error.message);
  }

  return NextResponse.json({ ok: true });
}