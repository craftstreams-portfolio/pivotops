import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export interface ApiAuthResult {
  userId:   string;
  tenantId: string;
  email:    string;
  role?:    string;
}

export async function getApiAuth(req: NextRequest): Promise<ApiAuthResult | null> {
  try {
    const cookies = req.cookies;
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookies.getAll(), setAll: () => {} } }
    );

    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return null;

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", session.user.id)
      .single();

    if (!profile?.tenant_id) return null;

    return {
      userId:   session.user.id,
      tenantId: profile.tenant_id,
      email:    session.user.email ?? "",
      role:     profile.role,
    };
  } catch {
    return null;
  }
}

export function unauthorized(msg = "Authentication required.") {
  return NextResponse.json({ error: msg }, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    }
  });
}

export function forbidden(msg = "Insufficient permissions.") {
  return NextResponse.json({ error: msg }, { status: 403 });
}