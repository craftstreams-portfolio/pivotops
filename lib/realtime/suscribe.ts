import { supabase } from "@/lib/supabase";
import { broadcast } from "@/lib/server/realtime";

export function startRealtimeListeners() {
  const tables = [
    "candidates",
    "tasks",
    "incidents",
    "onboarding",
    "compliance_docs",
  ];

  tables.forEach((table) => {
    supabase
      .channel(`rt-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          broadcast("DB_CHANGE", {
            table,
            payload,
          });
        }
      )
      .subscribe();
  });
}