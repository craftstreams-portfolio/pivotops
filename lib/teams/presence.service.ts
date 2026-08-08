import { supabase } from "../supabase";
import type { UserStatus } from "./status.engine";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export interface PresenceState {
  id:            string;
  user_id:       string;
  tenant_id:     string;
  status:        UserStatus;
  updated_at:    string;
  auto_detected: boolean;
}

// ─────────────────────────────────────────
// GET USER PRESENCE
// ─────────────────────────────────────────
export async function getUserPresence(
  userId: string
): Promise<PresenceState | null> {
  const { data, error } = await supabase
    .from("presence_states")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Presence] get failed:", error.message ?? error);
    return null;
  }

  return data as PresenceState | null;
}

// ─────────────────────────────────────────
// SET USER PRESENCE (upsert)
// ─────────────────────────────────────────
export async function setUserPresence(
  userId:       string,
  tenantId:     string,
  status:       UserStatus,
  autoDetected = false
): Promise<PresenceState | null> {
  const { data, error } = await supabase
    .from("presence_states")
    .upsert(
      {
        user_id:       userId,
        tenant_id:     tenantId,
        status,
        updated_at:    new Date().toISOString(),
        auto_detected: autoDetected,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[Presence] set failed:", error.message ?? error);
    return null;
  }

  return data as PresenceState;
}

// ─────────────────────────────────────────
// GET ALL PRESENCE FOR TENANT
// ─────────────────────────────────────────
export async function getTenantPresence(
  tenantId: string
): Promise<PresenceState[]> {
  const { data, error } = await supabase
    .from("presence_states")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[Presence] tenant fetch failed:", error.message ?? error);
    return [];
  }

  return data as PresenceState[];
}

// ─────────────────────────────────────────
// SUBSCRIBE TO PRESENCE CHANGES
// ─────────────────────────────────────────
export function subscribeToPresence(
  tenantId: string,
  onChange: (presence: PresenceState) => void
) {
  const channel = supabase
    .channel(`presence-${tenantId}`)
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "presence_states",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => onChange(payload.new as PresenceState)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─────────────────────────────────────────
// AUTO-SET OFFLINE after inactivity
// Call this on visibility change / beforeunload
// ─────────────────────────────────────────
export async function setOffline(userId: string, tenantId: string): Promise<void> {
  await setUserPresence(userId, tenantId, "OFFLINE", true);
}

// ─────────────────────────────────────────
// AUTO-SET ONLINE on page focus
// ─────────────────────────────────────────
export async function setOnline(userId: string, tenantId: string): Promise<void> {
  const current = await getUserPresence(userId);
  // Only auto-restore to ONLINE if was OFFLINE
  if (!current || current.status === "OFFLINE") {
    await setUserPresence(userId, tenantId, "ONLINE", true);
  }
}