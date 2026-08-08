import { supabase } from "../supabase";

export async function handleRoleUpdate(event: any) {
  const { tenant_id, user_id, role } = event.payload;

  const { error } = await supabase.from("user_roles").upsert({
    tenant_id,
    user_id,
    role,
  });

  if (error) {
    console.error("❌ Role update failed:", error);
  }
}