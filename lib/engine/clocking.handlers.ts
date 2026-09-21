import { supabase } from "../supabase";

// ===============================
// MAIN ENTRY POINT
// ===============================
export async function handleClockingEvent(event: any) {
  const { type, payload } = event;

  switch (type) {

    // ===============================
    // CLOCK IN
    // ===============================
    case "CLOCK_IN":
      return handleClockIn(payload);

    // ===============================
    // CLOCK OUT
    // ===============================
    case "CLOCK_OUT":
      return handleClockOut(payload);

    // ===============================
    // SHIFT START
    // ===============================
    case "SHIFT_STARTED":
      return handleShiftStart(payload);

    // ===============================
    // SHIFT END
    // ===============================
    case "SHIFT_ENDED":
      return handleShiftEnd(payload);

    default:
      console.log("Unhandled clocking event:", type);
  }
}

// ===============================
// 1. CLOCK IN
// ===============================
async function handleClockIn(payload: any) {
  const { user_id } = payload;

  const now = new Date().toISOString();

  await supabase.from("attendance").insert({
    user_id,
    clock_in: now,
    status: "active",
  });

  await supabase.from("event_logs").insert({
    type: "CLOCK_IN_RECORDED",
    module: "clocking",
    payload,
    status: "processed",
  });
}

// ===============================
// 2. CLOCK OUT
// ===============================
async function handleClockOut(payload: any) {
  const { user_id } = payload;

  const now = new Date().toISOString();

  // Find latest active session
  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user_id)
    .eq("status", "active")
    .order("clock_in", { ascending: false })
    .limit(1)
    .single();

  if (!data) return;

  const clockInTime = new Date(data.clock_in).getTime();
  const clockOutTime = new Date(now).getTime();

  const durationMinutes = Math.floor(
    (clockOutTime - clockInTime) / (1000 * 60)
  );

  await supabase
    .from("attendance")
    .update({
      clock_out: now,
      duration_minutes: durationMinutes,
      status: "completed",
    })
    .eq("id", data.id);

  await supabase.from("event_logs").insert({
    type: "CLOCK_OUT_RECORDED",
    module: "clocking",
    payload,
    status: "processed",
  });
}

// ===============================
// 3. SHIFT START
// ===============================
async function handleShiftStart(payload: any) {
  const { user_id, shift_name } = payload;

  await supabase.from("shifts").insert({
    user_id,
    shift_name,
    start_time: new Date().toISOString(),
    status: "active",
  });
}

// ===============================
// 4. SHIFT END
// ===============================
async function handleShiftEnd(payload: any) {
  const { user_id } = payload;

  const { data } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", user_id)
    .eq("status", "active")
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (!data) return;

  const endTime = new Date().toISOString();

  const startTime = new Date(data.start_time).getTime();
  const end = new Date(endTime).getTime();

  const hours = (end - startTime) / (1000 * 60 * 60);

  await supabase
    .from("shifts")
    .update({
      end_time: endTime,
      total_hours: hours,
      status: "completed",
    })
    .eq("id", data.id);

  await supabase.from("event_logs").insert({
    type: "SHIFT_COMPLETED",
    module: "clocking",
    payload,
    status: "processed",
  });
}