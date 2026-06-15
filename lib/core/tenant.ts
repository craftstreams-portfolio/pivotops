import { supabase } from "../supabase";

// ===============================
// TYPES
// ===============================
export type TenantPayload<T = any> = T & {
  tenant_id: string;
};

// ===============================
// GET CURRENT TENANT
// ===============================
export async function getCurrentTenant(userId: string) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return data.tenant_id;
}

// ===============================
// ATTACH TENANT TO PAYLOAD
// ===============================
export function withTenant<T>(payload: T, tenant_id: string): TenantPayload<T> {
  return {
    ...payload,
    tenant_id,
  };
}

// ===============================
// SAFE TENANT GUARD (VALIDATION)
// ===============================
export function assertTenant(tenant_id: any): asserts tenant_id is string {
  if (!tenant_id || typeof tenant_id !== "string") {
    throw new Error("Invalid tenant context");
  }
}

// ===============================
// SCOPED QUERY WRAPPER (READ)
// ===============================
export async function scopedSelect(
  table: string,
  tenant_id: string,
  select: string = "*"
) {
  assertTenant(tenant_id);

  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("tenant_id", tenant_id);

  if (error) {
    console.error(`Scoped select error on ${table}:`, error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

// ===============================
// SCOPED INSERT WRAPPER (WRITE)
// ===============================
export async function scopedInsert(
  table: string,
  payload: any,
  tenant_id: string
) {
  assertTenant(tenant_id);

  const { error } = await supabase.from(table).insert({
    ...payload,
    tenant_id,
  });

  if (error) {
    console.error(`Scoped insert error on ${table}:`, error);
  }
}

// ===============================
// SCOPED UPDATE WRAPPER
// ===============================
export async function scopedUpdate(
  table: string,
  id: string,
  updates: any,
  tenant_id: string,
  idField: string = "id"
) {
  assertTenant(tenant_id);

  const { error } = await supabase
    .from(table)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq(idField, id)
    .eq("tenant_id", tenant_id);

  if (error) {
    console.error(`Scoped update error on ${table}:`, error);
  }
}

// ===============================
// REAL-TIME TENANT CHANNEL FACTORY
// ===============================
export function createTenantChannel(
  channelName: string,
  tenant_id: string,
  table: string,
  callback: () => Promise<void>
) {
  return supabase
    .channel(`${channelName}-${tenant_id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `tenant_id=eq.${tenant_id}`,
      },
      async () => {
        await callback();
      }
    )
    .subscribe();
}

// ===============================
// TENANT EVENT ENRICHER
// ===============================
export function enrichEventWithTenant(event: any, tenant_id: string) {
  return {
    ...event,
    payload: {
      ...event.payload,
      tenant_id,
    },
  };
}