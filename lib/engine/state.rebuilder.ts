import { supabase } from "../supabase";

export async function rebuildFromEvents(
  timestamp: string,
  tenant_id: string
) {
  // your logic
}

// ===============================
// STATE TYPES
// ===============================
type SystemState = {
  candidates: Record<string, any>;
  tasks: Record<string, any>;
};

// ===============================
// FETCH ALL EVENTS
// ===============================
async function fetchAllEvents() {
  const { data, error } = await supabase
    .from("event_logs")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Failed fetching events:", error);
    return [];
  }

  return data || [];
}

// ===============================
// APPLY SINGLE EVENT TO STATE
// ===============================
function applyEvent(state: SystemState, event: any) {
  const { type, payload } = event;

  // =========================
  // CANDIDATE EVENTS
  // =========================
  if (
    type === "CANDIDATE_CREATED" ||
    type === "CANDIDATE_STATUS_CHANGED" ||
    type === "CANDIDATE_UPDATED"
  ) {
    const id = payload?.candidate_id || payload?.id;
    if (!id) return;

    state.candidates[id] = {
      ...(state.candidates[id] || {}),
      ...payload,
      id,
    };
  }

  // =========================
  // TASK EVENTS
  // =========================
  if (
    type === "TASK_CREATED" ||
    type === "TASK_UPDATED"
  ) {
    const id = payload?.task_id || payload?.id;
    if (!id) return;

    state.tasks[id] = {
      ...(state.tasks[id] || {}),
      ...payload,
      id,
    };
  }
}

// ===============================
// MAIN REBUILD FUNCTION
// ===============================
export async function rebuildSystemState(): Promise<SystemState> {
  console.log("🧠 Rebuilding system state from event log...");

  const events = await fetchAllEvents();

  const state: SystemState = {
    candidates: {},
    tasks: {},
  };

  for (const event of events) {
    try {
      applyEvent(state, event);
    } catch (err) {
      console.error("❌ Event apply failed:", event, err);
    }
  }

  console.log("✅ State rebuild complete:", {
    candidates: Object.keys(state.candidates).length,
    tasks: Object.keys(state.tasks).length,
  });

  return state;
}