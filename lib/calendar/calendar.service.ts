import { supabase } from "../supabase";

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

export async function createMeeting(data: {
  title:          string;
  description?:   string;
  meetingType:    string;
  hostUserId:     string;
  department?:    string;
  scheduledStart: string;
  scheduledEnd:   string;
}) {
  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      title:          data.title,
      description:    data.description ?? null,
      meeting_type:   data.meetingType,
      host_user_id:   data.hostUserId,
      department:     data.department ?? null,
      scheduled_start: data.scheduledStart,
      scheduled_end:   data.scheduledEnd,
      meeting_status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    throw new Error(extractMessage(error));
  }

  return meeting;
}

export async function getMeetings() {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_start", { ascending: true });

  if (error) {
    throw new Error(extractMessage(error));
  }

  return data;
}