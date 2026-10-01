import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client (service-role).
 * Created lazily inside the function so the service-role key is never
 * evaluated at module load or bundled into client code. Only runs server-side.
 */
export function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}