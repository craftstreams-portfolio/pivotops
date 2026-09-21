import { supabase } from "@/lib/supabase";

export function subscribeToVoiceRoom(roomId: string, callback: (payload: any) => void) {
  const channel = supabase.channel(`voice-room-${roomId}`);

  channel
    .on("broadcast", { event: "signal" }, ({ payload }) => {
      callback(payload);
    })
    .subscribe();

  return channel;
}

export async function sendSignal(roomId: string, payload: any) {
  await supabase.channel(`voice-room-${roomId}`).send({
    type: "broadcast",
    event: "signal",
    payload,
  });
}