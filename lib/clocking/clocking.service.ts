import { supabase } from "../supabase";

/**
 * Direct Supabase writes — bypasses the event bus
 * so RLS applies correctly on the client session.
 * type must be "CLOCK_IN" or "CLOCK_OUT" to match DB schema.
 */

export async function clockIn(payload: {
  user_id:   string;
  tenant_id: string;
  timezone?: string;
  location?: string | null;
}) {
  const { data, error } = await supabase
    .from("clocking_logs")
    .insert({
      user_id:   payload.user_id,
      tenant_id: payload.tenant_id,
      type:      "CLOCK_IN",
      timestamp: new Date().toISOString(),
      timezone:  payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      location:  payload.location ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message ?? JSON.stringify(error));
  }

  return data;
}

export async function clockOut(payload: {
  user_id:        string;
  tenant_id:      string;
  timezone?:      string;
  location?:      string | null;
  sessionMinutes?: number;
}) {
  const { data, error } = await supabase
    .from("clocking_logs")
    .insert({
      user_id:   payload.user_id,
      tenant_id: payload.tenant_id,
      type:      "CLOCK_OUT",
      timestamp: new Date().toISOString(),
      timezone:  payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      location:  payload.location ?? null,
      metadata:  payload.sessionMinutes
        ? { session_minutes: payload.sessionMinutes }
        : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message ?? JSON.stringify(error));
  }

  return data;
}

export async function getClockingLogs(tenantId: string, limit = 50) {
  const { data, error } = await supabase
    .from("clocking_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message ?? JSON.stringify(error));
  }

  return data ?? [];
}

export async function getEmployeeLogsForWeek(
  userId:    string,
  tenantId:  string,
  weekStart: string,  // YYYY-MM-DD Monday
  weekEnd:   string   // YYYY-MM-DD Sunday
) {
  const { data, error } = await supabase
    .from("clocking_logs")
    .select("*")
    .eq("user_id",   userId)
    .eq("tenant_id", tenantId)
    .gte("timestamp", weekStart + "T00:00:00")
    .lte("timestamp", weekEnd   + "T23:59:59")
    .order("timestamp", { ascending: true });

  if (error) {
    throw new Error(error.message ?? JSON.stringify(error));
  }

  return data ?? [];
}