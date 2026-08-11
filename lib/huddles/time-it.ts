/**
 * lib/huddles/time-it.ts
 *
 * Server-authoritative Time It engine for Huddles, Speaker Mode only
 * (Agenda Mode is a later phase). Every write to meeting_timer_state goes
 * through here, called exclusively from app/api/huddles/time-it/* routes -
 * never written to directly from the client, so remaining_seconds cannot be
 * manipulated via browser devtools per spec section 40.
 *
 * remaining_seconds is a snapshot, not a live countdown - actual remaining
 * time is always derived from (duration_seconds - elapsed since started_at)
 * at read time, so client clock drift never desyncs from server truth.
 */
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface TimerState {
  id: string;
  room_id: string;
  status: "idle" | "running" | "paused" | "expired";
  current_speaker_id: string | null;
  duration_seconds: number;
  remaining_seconds: number;   // live-computed, not the raw DB value
  auto_mute: boolean;
  warning_60_fired: boolean;
  warning_30_fired: boolean;
  extension_seconds: number;
}

/** Verifies the caller is the room's host. Server-side, per spec section 25. */
export async function verifyIsHost(roomId: string, userId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin.from("voice_rooms").select("created_by").eq("id", roomId).maybeSingle();
  return !!data && data.created_by === userId;
}

/** Live-compute remaining seconds from server truth, never trust a client-sent value. */
function computeRemaining(row: any): number {
  if (row.status !== "running" || !row.started_at) return row.remaining_seconds;
  const elapsed = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
  return Math.max(0, row.remaining_seconds - elapsed);
}

export async function getTimerState(roomId: string): Promise<TimerState | null> {
  const admin = getAdmin();
  const { data } = await admin.from("meeting_timer_state").select("*").eq("room_id", roomId).maybeSingle();
  if (!data) return null;
  return { ...data, remaining_seconds: computeRemaining(data) };
}

async function logEvent(admin: ReturnType<typeof getAdmin>, tenantId: string, roomId: string, participantId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  await admin.from("time_it_events").insert({
    tenant_id: tenantId, room_id: roomId, participant_id: participantId,
    event_type: eventType, metadata,
  });
}

export async function startTimer(params: {
  roomId: string; tenantId: string; hostId: string;
  speakerId: string; speakerName: string; durationSeconds: number; autoMute: boolean;
}): Promise<TimerState> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data, error } = await admin.from("meeting_timer_state")
    .upsert({
      room_id: params.roomId, tenant_id: params.tenantId,
      mode: "speaker", status: "running",
      current_speaker_id: params.speakerId,
      duration_seconds: params.durationSeconds,
      remaining_seconds: params.durationSeconds,
      auto_mute: params.autoMute,
      warning_60_fired: false, warning_30_fired: false,
      started_at: now, paused_at: null, extension_seconds: 0,
      created_by: params.hostId, updated_at: now,
    }, { onConflict: "room_id" })
    .select().single();

  if (error) throw new Error(error.message);

  await logEvent(admin, params.tenantId, params.roomId, params.speakerId, "timer_started", {
    speaker_name: params.speakerName, duration_seconds: params.durationSeconds,
  });

  return { ...data, remaining_seconds: params.durationSeconds };
}

export async function pauseTimer(roomId: string, tenantId: string): Promise<TimerState> {
  const admin = getAdmin();
  const current = await getTimerState(roomId);
  if (!current) throw new Error("No active timer for this room.");

  const { data, error } = await admin.from("meeting_timer_state")
    .update({ status: "paused", remaining_seconds: current.remaining_seconds, paused_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("room_id", roomId).select().single();
  if (error) throw new Error(error.message);

  await logEvent(admin, tenantId, roomId, current.current_speaker_id, "timer_paused");
  return { ...data, remaining_seconds: data.remaining_seconds };
}

export async function resumeTimer(roomId: string, tenantId: string): Promise<TimerState> {
  const admin = getAdmin();
  const current = await getTimerState(roomId);
  if (!current) throw new Error("No active timer for this room.");

  const { data, error } = await admin.from("meeting_timer_state")
    .update({ status: "running", started_at: new Date().toISOString(), paused_at: null, updated_at: new Date().toISOString() })
    .eq("room_id", roomId).select().single();
  if (error) throw new Error(error.message);

  await logEvent(admin, tenantId, roomId, current.current_speaker_id, "timer_resumed");
  return { ...data, remaining_seconds: current.remaining_seconds };
}

export async function extendTimer(roomId: string, tenantId: string, extraSeconds: number): Promise<TimerState> {
  const admin = getAdmin();
  const current = await getTimerState(roomId);
  if (!current) throw new Error("No active timer for this room.");

  // If time had expired and the speaker was auto-muted, granting an
  // extension restores speaking permission per spec section 11 - unmute
  // happens in the route handler, which has access to the participant table.
  const newRemaining = current.remaining_seconds + extraSeconds;
  const { data, error } = await admin.from("meeting_timer_state")
    .update({
      status: "running",
      remaining_seconds: newRemaining,
      duration_seconds: current.duration_seconds + extraSeconds,
      extension_seconds: current.extension_seconds + extraSeconds,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId).select().single();
  if (error) throw new Error(error.message);

  await logEvent(admin, tenantId, roomId, current.current_speaker_id, "extension_granted", { extra_seconds: extraSeconds });
  return { ...data, remaining_seconds: newRemaining };
}

export async function skipSpeaker(roomId: string, tenantId: string): Promise<TimerState> {
  const admin = getAdmin();
  const current = await getTimerState(roomId);
  if (!current) throw new Error("No active timer for this room.");

  const { data, error } = await admin.from("meeting_timer_state")
    .update({ status: "idle", current_speaker_id: null, remaining_seconds: 0, updated_at: new Date().toISOString() })
    .eq("room_id", roomId).select().single();
  if (error) throw new Error(error.message);

  await logEvent(admin, tenantId, roomId, current.current_speaker_id, "speaker_skipped");
  return { ...data, remaining_seconds: 0 };
}

export async function endTimer(roomId: string, tenantId: string): Promise<void> {
  const admin = getAdmin();
  const current = await getTimerState(roomId);
  await admin.from("meeting_timer_state")
    .update({ status: "idle", current_speaker_id: null, updated_at: new Date().toISOString() })
    .eq("room_id", roomId);
  await logEvent(admin, tenantId, roomId, current?.current_speaker_id ?? null, "timer_reset");
}

/**
 * Checks a running timer for warning thresholds and expiration, firing the
 * appropriate side effects (event log, auto-mute). Called on each poll from
 * the check-expiry route rather than a server-side cron, since Huddles has
 * no background worker infrastructure (confirmed earlier this session - the
 * events/worker subsystem's setInterval loops die on serverless return).
 */
export async function checkAndAdvance(roomId: string, tenantId: string): Promise<TimerState | null> {
  const admin = getAdmin();
  const state = await getTimerState(roomId);
  if (!state || state.status !== "running") return state;

  const updates: Record<string, unknown> = {};

  if (state.remaining_seconds <= 60 && !state.warning_60_fired) {
    updates.warning_60_fired = true;
    await logEvent(admin, tenantId, roomId, state.current_speaker_id, "warning_60");
  }
  if (state.remaining_seconds <= 30 && !state.warning_30_fired) {
    updates.warning_30_fired = true;
    await logEvent(admin, tenantId, roomId, state.current_speaker_id, "warning_30");
  }
  if (state.remaining_seconds <= 0) {
    updates.status = "expired";
    // Must persist remaining_seconds=0 here - computeRemaining() only
    // live-projects elapsed time while status is "running", so once expired
    // the raw column would otherwise sit at its last written value (the
    // original duration, since nothing else updates it while ticking down
    // naturally). Without this, extendTimer() reads that stale large number
    // and adds the extension on top of it - a +30s grant became 1:30
    // instead of 0:30 because it was really "stale ~60s" + 30s.
    updates.remaining_seconds = 0;
    await logEvent(admin, tenantId, roomId, state.current_speaker_id, "timer_expired");

    if (state.auto_mute && state.current_speaker_id) {
      await admin.from("voice_room_participants")
        .update({ is_muted: true, mute_reason: "time_it_expired" })
        .eq("room_id", roomId).eq("user_id", state.current_speaker_id);
      await logEvent(admin, tenantId, roomId, state.current_speaker_id, "speaker_muted", { reason: "time_it_expired" });
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    await admin.from("meeting_timer_state").update(updates).eq("room_id", roomId);
  }

  return { ...state, ...updates } as TimerState;
}
// ─────────────────────────────────────────────────────────────────
// AGENDA MODE (Phase 2). Reuses meeting_timer_state's existing
// start/pause/resume/expire machinery is NOT reused here directly -
// agenda items are simpler (no per-speaker mute), so they get their
// own lighter functions operating on meeting_agenda_items plus the
// active_agenda_item_id pointer on meeting_timer_state.
// ─────────────────────────────────────────────────────────────────

export interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  duration_seconds: number;
  remaining_seconds: number;
  status: "upcoming" | "active" | "completed" | "skipped";
  sort_order: number;
  started_at: string | null;
}

function computeAgendaRemaining(row: any): number {
  if (row.status !== "active" || !row.started_at) return row.remaining_seconds;
  const elapsed = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
  return Math.max(0, row.remaining_seconds - elapsed);
}

export async function getAgenda(roomId: string): Promise<AgendaItem[]> {
  const admin = getAdmin();
  const { data } = await admin.from("meeting_agenda_items")
    .select("*").eq("room_id", roomId).order("sort_order", { ascending: true });
  return (data ?? []).map((r) => ({ ...r, remaining_seconds: computeAgendaRemaining(r) }));
}

export async function addAgendaItem(params: {
  roomId: string; tenantId: string; hostId: string;
  title: string; description?: string; ownerId?: string; durationSeconds: number;
}): Promise<AgendaItem> {
  const admin = getAdmin();
  const { data: existing } = await admin.from("meeting_agenda_items")
    .select("sort_order").eq("room_id", params.roomId).order("sort_order", { ascending: false }).limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await admin.from("meeting_agenda_items").insert({
    room_id: params.roomId, tenant_id: params.tenantId,
    title: params.title, description: params.description ?? null,
    owner_id: params.ownerId ?? null, duration_seconds: params.durationSeconds,
    remaining_seconds: params.durationSeconds, status: "upcoming",
    sort_order: nextOrder, created_by: params.hostId,
  }).select().single();
  if (error) throw new Error(error.message);

  await logEvent(admin, params.tenantId, params.roomId, null, "agenda_item_added", { title: params.title });
  return { ...data, remaining_seconds: params.durationSeconds };
}

export async function startAgendaItem(roomId: string, tenantId: string, itemId: string): Promise<AgendaItem> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  // Only one agenda item active at a time - close out whatever was running.
  await admin.from("meeting_agenda_items")
    .update({ status: "completed", updated_at: now })
    .eq("room_id", roomId).eq("status", "active");

  const { data, error } = await admin.from("meeting_agenda_items")
    .update({ status: "active", started_at: now, updated_at: now })
    .eq("id", itemId).select().single();
  if (error) throw new Error(error.message);

  await admin.from("meeting_timer_state")
    .upsert({ room_id: roomId, tenant_id: tenantId, mode: "agenda", status: "running", active_agenda_item_id: itemId, updated_at: now }, { onConflict: "room_id" });

  await logEvent(admin, tenantId, roomId, null, "agenda_started", { item_id: itemId, title: data.title });
  return { ...data, remaining_seconds: data.duration_seconds };
}

export async function completeAgendaItem(roomId: string, tenantId: string, itemId: string): Promise<void> {
  const admin = getAdmin();
  await admin.from("meeting_agenda_items")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", itemId);
  await admin.from("meeting_timer_state")
    .update({ active_agenda_item_id: null, status: "idle" })
    .eq("room_id", roomId);
  await logEvent(admin, tenantId, roomId, null, "agenda_completed", { item_id: itemId });
}

export async function skipAgendaItem(roomId: string, tenantId: string, itemId: string): Promise<void> {
  const admin = getAdmin();
  await admin.from("meeting_agenda_items")
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("id", itemId);
  await admin.from("meeting_timer_state")
    .update({ active_agenda_item_id: null, status: "idle" })
    .eq("room_id", roomId);
  await logEvent(admin, tenantId, roomId, null, "agenda_item_skipped", { item_id: itemId });
}

export async function extendAgendaItem(roomId: string, tenantId: string, itemId: string, extraSeconds: number): Promise<AgendaItem> {
  const admin = getAdmin();
  const { data: current } = await admin.from("meeting_agenda_items").select("*").eq("id", itemId).single();
  const remaining = computeAgendaRemaining(current);

  const { data, error } = await admin.from("meeting_agenda_items")
    .update({
      remaining_seconds: remaining + extraSeconds,
      duration_seconds: current.duration_seconds + extraSeconds,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId).select().single();
  if (error) throw new Error(error.message);

  await logEvent(admin, tenantId, roomId, null, "agenda_extended", { item_id: itemId, extra_seconds: extraSeconds });
  return { ...data, remaining_seconds: remaining + extraSeconds };
}

/** Same pattern as checkAndAdvance - client-polled, since no worker exists. */
export async function checkAgendaAdvance(roomId: string, tenantId: string): Promise<AgendaItem | null> {
  const admin = getAdmin();
  const { data: active } = await admin.from("meeting_agenda_items")
    .select("*").eq("room_id", roomId).eq("status", "active").maybeSingle();
  if (!active) return null;

  const remaining = computeAgendaRemaining(active);
  if (remaining <= 0 && active.status === "active") {
    // Agenda item time expired - unlike Speaker Mode there's no auto-mute;
    // it just flags as needing host attention (spec section 16: host sees
    // AGENDA TIME EXPIRED with Continue/End Item/Add Time options). We
    // surface this via remaining_seconds=0 while status stays "active" -
    // the UI reads that combination as expired, host decides what's next.
    await logEvent(admin, tenantId, roomId, null, "agenda_item_expired", { item_id: active.id });
  }
  return { ...active, remaining_seconds: remaining };
}
