import { supabase } from "../supabase";

export async function handleShowcaseEvent(event: any) {
  const { tenant_id, title, description, created_by } =
    event.payload;

  const { error } = await supabase.from("showcases").insert({
    tenant_id,
    title,
    description,
    created_by,
  });

  if (error) {
    console.error("❌ Showcase failed:", error);
  }
}