import { supabase } from "@/lib/supabase";

export type VoiceRoom = {
  id: string;
  name: string;
  department?: string;
  createdBy?: string;
  isActive: boolean;
};

export async function createVoiceRoom(params: {
  id: string;
  name: string;
  createdBy: string;
  department?: string;
}) {
  const { data, error } = await supabase
    .from("voice_rooms")
    .insert({
      id: params.id,
      name: params.name,
      created_by: params.createdBy,
      department: params.department || "general",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getVoiceRooms() {
  const { data, error } = await supabase
    .from("voice_rooms")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function joinVoiceRoom(roomId: string, userId: string) {
  const { error } = await supabase
    .from("voice_room_participants")
    .insert({
      room_id: roomId,
      user_id: userId,
    });

  if (error) throw error;
}

export function createPeerConnection() {
  const config: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
    ],
  };

  return new RTCPeerConnection(config);
}