import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyIsHost } from "@/lib/huddles/time-it";

export async function requireHost(req: NextRequest, roomId: string) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();

  const isHost = await verifyIsHost(roomId, user.id);
  if (!isHost) return { error: NextResponse.json({ error: "Only the host can control Time It." }, { status: 403 }) };

  return { userId: user.id, tenantId: profile?.tenant_id ?? "" };
}