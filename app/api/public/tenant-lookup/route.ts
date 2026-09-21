import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const admin = getAdmin();
    const { data, error } = await admin
      .from("tenants")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: "Apply link not found" }, { status: 404 });
    }

    return NextResponse.json({ tenantId: data.id, tenantName: data.name });
  } catch (err) {
    console.error("tenant-lookup error", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
