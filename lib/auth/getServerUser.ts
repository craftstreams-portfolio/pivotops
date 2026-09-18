import "server-only";
import { createServerSupabase } from "../supabase.server";

export async function getServerUser() {
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function getServerTenantId(): Promise<string> {
  const user = await getServerUser();
  return user?.user_metadata?.tenant_id ?? "default";
}