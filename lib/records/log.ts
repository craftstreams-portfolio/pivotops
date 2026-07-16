import { supabase } from "@/lib/supabase";

export type RecordKind =
  | "commendation" | "note" | "role_change" | "onboarding"
  | "offboarding"  | "compliance" | "timesheet" | "milestone";

/**
 * Append one entry to an employee's activity ledger (employee_records).
 *
 * Fire-and-forget: this NEVER throws. Logging a record must not break the
 * operation that triggered it (a role save, a timesheet correction, etc.),
 * so all errors are swallowed and only logged to the console.
 *
 * Pass a client when calling from an API route (service-role); browser
 * callers can omit it and the shared browser client is used.
 */
export async function logEmployeeRecord(
  entry: {
    tenantId:  string;
    userId:    string;         // the employee the record is ABOUT
    kind:      RecordKind;
    title:     string;
    detail?:   string | null;
    createdBy?: string | null; // who caused it (null = system/derived)
  },
  client?: { from: (t: string) => any }
): Promise<void> {
  try {
    const db = client ?? supabase;
    await db.from("employee_records").insert({
      tenant_id:  entry.tenantId,
      user_id:    entry.userId,
      kind:       entry.kind,
      title:      entry.title,
      detail:     entry.detail ?? null,
      created_by: entry.createdBy ?? null,
    });
  } catch (e) {
    console.error("[logEmployeeRecord] failed (non-fatal):", e);
  }
}