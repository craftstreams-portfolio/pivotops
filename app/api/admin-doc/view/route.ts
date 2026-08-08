import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
function authClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: userErr } = await authClient().auth.getUser(token);
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdmin();
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const fileId = req.nextUrl.searchParams.get("fileId");
    if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

    // Verify the file belongs to this tenant
    const { data: file } = await admin.from("admin_doc_files").select("file_url, tenant_id, name").eq("id", fileId).single();
    if (!file || file.tenant_id !== tenantId) return NextResponse.json({ error: "Not found in your tenant" }, { status: 404 });
    if (!file.file_url) return NextResponse.json({ error: "No file" }, { status: 404 });

    // Extract path after "/admin-documents/" and sign it
    const marker = "/admin-documents/";
    const idx = file.file_url.indexOf(marker);
    const objPath = idx >= 0 ? decodeURIComponent(file.file_url.substring(idx + marker.length)) : file.file_url;
    const { data, error } = await admin.storage.from("admin-documents").createSignedUrl(objPath, 3600);
    if (error || !data) return NextResponse.json({ error: "Could not generate link: " + (error?.message ?? "") }, { status: 500 });

    return NextResponse.json({ url: data.signedUrl, name: file.name });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}