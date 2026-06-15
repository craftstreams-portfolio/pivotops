import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
export interface AuthResult { userId: string; tenantId: string; role: string; email: string; }
export async function validateSession(req: NextRequest): Promise<AuthResult | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data: profile } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
    return { userId: user.id, tenantId: profile?.tenant_id ?? "default", role: profile?.role ?? "employee", email: user.email ?? "" };
  } catch { return null; }
}
export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}