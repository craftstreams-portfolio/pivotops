import { supabase } from "../supabase";

/**
 * EVENT AUDIT LOGGER
 * Tracks lifecycle of every system event
 */
export async function logEventAudit(
  event: any,
  status:
    | "received"
    | "processed"
    | "failed"
    | "ignored"
    | "retrying"
) {
  try {
    // ===============================
    // HARD VALIDATION
    // ===============================
    if (!event?.type) {
      console.warn("⚠️ Invalid audit event:", event);
      return;
    }

    // ===============================
    // SAFE AUDIT RECORD
    // ===============================
    const auditRow = {
      type: event.type,
      payload: event.payload || {},
      status,
      created_at: new Date().toISOString(),

      // Optional metadata
      event_id: event?.id || null,
      source: "workforce-engine",
    };

    // ===============================
    // INSERT AUDIT LOG
    // ===============================
    const { error } = await supabase
      .from("event_audit_logs")
      .insert(auditRow);

    if (error) {
      console.error("❌ Audit insert failed:", error);
      return;
    }

    console.log("🧾 EVENT AUDITED:", {
      type: auditRow.type,
      status: auditRow.status,
    });

  } catch (err) {
    console.error("🔥 Audit log crashed:", err);
  }
}