import { supabase } from "./supabase";

export async function logActivity({
  type,
  title,
  description,
  user_name,
  entity_id,
  entity_type,
  meta = {},
}: {
  type: string;
  title: string;
  description?: string;
  user_name?: string;
  entity_id?: string;
  entity_type?: string;
  meta?: any;
}) {
  await supabase.from("activities").insert({
    type,
    title,
    description,
    user_name,
    entity_id,
    entity_type,
    meta,
  });
}