import { supabase } from "@/lib/supabase";

export function subscribeToMeetings(callback: (payload: any) => void) {
  const channel = supabase.channel("meetings-live");

  channel
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "meetings",
    }, (payload) => {
      callback(payload);
    })
    .subscribe();

  return channel;
}