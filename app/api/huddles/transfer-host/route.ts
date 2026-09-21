import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transferHost } from "@/lib/huddles/transferHost";

export async function POST(req: NextRequest) {
  const { roomId, newHostId } = await req.json();
  if (!roomId || !newHostId) return NextResponse.json({ error: "roomId and newHostId required." }, { status: 400 });

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();

  try {
    await transferHost({ roomId, tenantId: profile?.tenant_id ?? "", fromUserId: user.id, toUserId: newHostId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to transfer host." }, { status: 403 });
  }
}