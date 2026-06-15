import { supabase } from "@/lib/supabase";

export async function logAudit({
  action,
  actorName,
  actorId,
  entityType,
  entityId,
  metadata,
}: {
  action: string;
  actorName?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("audit_logs").insert({
    action,
    actor_name: actorName,
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata || {},
  });
}