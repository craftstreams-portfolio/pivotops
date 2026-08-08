import { supabase } from "../supabase";

export type WorkMode = "remote" | "onsite" | "hybrid";

export interface Profile {
  id:          string;
  full_name:   string | null;
  email:       string | null;
  department:  string | null;
  position:    string | null;
  role:        string | null;
  avatar_url:  string | null;
  tenant_id:   string | null;
  timezone:    string | null;
  location:    string | null;
  work_mode:   WorkMode | null;
  date_joined: string | null;
  phone:       string | null;
  updated_at:  string | null;
  created_at:  string | null;
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Profile fetch failed: ${extractMessage(error)}`);
  }

  return data as Profile;
}

export async function upsertProfile(payload: {
  full_name:    string;
  department:   string;
  position:     string;
  timezone:     string;
  tenant_id:    string;
  location?:    string;
  work_mode?:   WorkMode;
  date_joined?: string;
  phone?:       string;
}): Promise<Profile> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id:          session.user.id,
      email:       session.user.email,
      full_name:   payload.full_name,
      department:  payload.department,
      position:    payload.position,
      timezone:    payload.timezone,
      tenant_id:   payload.tenant_id,
      location:    payload.location    ?? null,
      work_mode:   payload.work_mode   ?? "onsite",
      date_joined: payload.date_joined ?? null,
      phone:       payload.phone       ?? null,
      updated_at:  new Date().toISOString(),
    }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Profile save failed: ${extractMessage(error)}`);
  }

  return data as Profile;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const ext  = file.name.split(".").pop();
  const path = `avatars/${session.user.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    throw new Error(`Avatar upload failed: ${extractMessage(uploadError)}`);
  }

  const { data } = supabase.storage
    .from("chat-media")
    .getPublicUrl(path);

  await supabase
    .from("profiles")
    .update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);

  return data.publicUrl;
}

export async function getAllProfiles(tenantId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(`Profiles fetch failed: ${extractMessage(error)}`);
  }

  return (data ?? []) as Profile[];
}

export function getYearsOfService(dateJoined: string | null): string {
  if (!dateJoined) return "—";
  const start  = new Date(dateJoined);
  const now    = new Date();
  const years  = now.getFullYear() - start.getFullYear();
  const months = now.getMonth() - start.getMonth();
  const total  = years + (months < 0 ? -1 : 0);
  const rem    = months < 0 ? months + 12 : months;
  if (total === 0) return rem === 0 ? "< 1 month" : `${rem} month${rem !== 1 ? "s" : ""}`;
  if (rem   === 0) return `${total} yr${total !== 1 ? "s" : ""}`;
  return `${total} yr${total !== 1 ? "s" : ""} ${rem} mo`;
}