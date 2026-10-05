import { supabase } from "../supabase";

export async function createAuditLog(payload: {
  tenant_id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: any;
}) {
  const { error } = await supabase
    .from("audit_logs")
    .insert(payload);

  if (error) {
    console.error(
      "❌ Audit log failed:",
      error
    );
  }
}