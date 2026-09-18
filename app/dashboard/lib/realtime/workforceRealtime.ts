import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export function subscribeToWorkforceEvents(
  callback: (payload: any) => void
) {
  return supabase
    .channel("pivotops-workforce")
    .on(
      "broadcast",
      { event: "*" },
      (payload) => callback(payload)
    )
    .subscribe();
}

export async function broadcastWorkforceEvent(
  type: string,
  payload: any
) {
  await supabase.channel("pivotops-workforce").send({
    type: "broadcast",
    event: type,
    payload,
  });
}