import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.ADMIN_SECRET_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, plan } = await req.json();
  const allowed = ["free","starter","professional","enterprise"];
  if (!tenantId || !allowed.includes(plan)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const { error } = await admin
    .from("subscriptions")
    .upsert({
      tenant_id:   tenantId,
      plan,
      status:      "active",
      updated_at:  new Date().toISOString(),
    }, { onConflict: "tenant_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}