import { supabase } from "../supabase";

export type MeetingStatus =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

export interface Meeting {
  id:              string;
  title:           string;
  meeting_type:    string;
  host_user_id:    string;
  department?:     string | null;
  scheduled_start: string;
  scheduled_end:   string;
  status:          MeetingStatus;
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// GET ALL MEETINGS
// ─────────────────────────────────────────
export async function getMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_start", { ascending: true });

  if (error) throw new Error(`Failed to fetch meetings: ${extractMessage(error)}`);

  return (data ?? []).map((m: any) => ({
    id:              m.id,
    title:           m.title,
    meeting_type:    m.meeting_type,
    host_user_id:    m.host_user_id,
    department:      m.department ?? null,
    scheduled_start: m.scheduled_start,
    scheduled_end:   m.scheduled_end,
    // DB has meeting_status column
    status:          (m.meeting_status ?? m.status ?? "scheduled") as MeetingStatus,
  }));
}

// ─────────────────────────────────────────
// GET SINGLE MEETING
// ─────────────────────────────────────────
export async function getMeetingById(meetingId: string) {
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (error) throw new Error(`Failed to fetch meeting: ${extractMessage(error)}`);

  const { data: voiceMap } = await supabase
    .from("meeting_voice_map")
    .select("*")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  return {
    meeting,
    voiceRoomId: voiceMap?.room_id ?? null,
  };
}

// ─────────────────────────────────────────
// UPDATE STATUS
// ─────────────────────────────────────────
export async function updateMeetingStatus(
  meetingId: string,
  status: MeetingStatus
) {
  const { data, error } = await supabase
    .from("meetings")
    .update({ meeting_status: status })
    .eq("id", meetingId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update meeting: ${extractMessage(error)}`);
  return data;
}

// ─────────────────────────────────────────
// SHORTCUTS
// ─────────────────────────────────────────
export const startMeeting    = (id: string) => updateMeetingStatus(id, "active");
export const completeMeeting = (id: string) => updateMeetingStatus(id, "completed");
export const cancelMeeting   = (id: string) => updateMeetingStatus(id, "cancelled");