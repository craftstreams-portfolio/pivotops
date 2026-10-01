"use client";
import { supabase } from "./supabase";

export async function getTenantId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.user_metadata?.tenant_id ?? "default";
}

export function withTenant<T extends { tenant_id?: string }>(
  data: Omit<T, "tenant_id">,
  tenantId: string
): T {
  return { ...data, tenant_id: tenantId } as T;
}