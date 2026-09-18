import { createVoiceRoom } from ".../../../lib/voice/voiceRoomEngine";
import { supabase } from "@/lib/supabase";

/**
 * ===============================
 * MEETING → VOICE BRIDGE ENGINE
 * ===============================
 * Ensures every meeting has exactly one stable voice room
 */

export async function attachVoiceRoomToMeeting(meetingId: string) {
  try {
    // ===============================
    // 1. CHECK IF ROOM ALREADY EXISTS (IDEMPOTENCY SAFETY)
    // ===============================
    const { data: existingMap, error: fetchError } = await supabase
      .from("meeting_voice_map")
      .select("*")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    // If already exists → return existing room (NO DUPLICATION)
    if (existingMap?.room_id) {
      return existingMap.room_id;
    }

    // ===============================
    // 2. CREATE NEW VOICE ROOM
    // ===============================
    const roomId = crypto.randomUUID();

    await createVoiceRoom({
      id: roomId,
      name: `Meeting Room - ${meetingId}`,
      createdBy: "system",
    });

    // ===============================
    // 3. STORE MAPPING (MEETING ↔ VOICE ROOM)
    // ===============================
    const { error: insertError } = await supabase
      .from("meeting_voice_map")
      .insert({
        meeting_id: meetingId,
        room_id: roomId,
      });

    if (insertError) throw insertError;

    // ===============================
    // 4. RETURN ROOM ID
    // ===============================
    return roomId;

  } catch (error) {
    console.error("Failed to attach voice room to meeting:", error);
    throw error;
  }
}