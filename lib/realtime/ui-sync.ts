import { supabase } from "../supabase";
import { trimMap } from "./cache-limits";
import { startTransition } from "react";

// ===============================
// GLOBAL UI STATE CACHE
// ===============================
const cache = {
  candidates: new Map<string, any>(),
  tasks: new Map<string, any>(),
};

// ===============================
// UI LISTENERS REGISTRY
// ===============================
const listeners = new Set<() => void>();

// ===============================
// REPLAY GUARD (HARDENED)
// ===============================
const processedEvents = new Set<string>();

const MAX_PROCESSED_EVENTS = 5000;

function safeAddEvent(key: string) {
  if (processedEvents.size > MAX_PROCESSED_EVENTS) {
    processedEvents.clear();
  }

  processedEvents.add(key);
}

// ===============================
// EVENT KEY NORMALIZER
// ===============================
function getEventKey(event: any): string {
  const payload = event?.payload || {};

  return String(
    `${event?.type || "unknown"}|${
      payload?.candidate_id ||
      payload?.task_id ||
      payload?.id ||
      "none"
    }|${payload?.updated_at || ""}`
  );
}

// ===============================
// SUBSCRIBE UI COMPONENTS
// ===============================
export function subscribeUI(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// ===============================
// NOTIFY UI (FIXED: BATCHED)
// ===============================
let uiScheduled = false;

function notifyUI() {
  if (uiScheduled) return;

  uiScheduled = true;

  startTransition(() => {
    setTimeout(() => {
      uiScheduled = false;

      listeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.error("❌ UI listener crashed:", err);
        }
      });
    }, 50);
  });
}

// ===============================
// SAFE TIMESTAMP CHECK
// ===============================
function isIncomingNewer(
  existing: any,
  incoming: any
): boolean {
  const existingTime = existing?.updated_at
    ? new Date(existing.updated_at).getTime()
    : 0;

  const incomingTime = incoming?.updated_at
    ? new Date(incoming.updated_at).getTime()
    : Date.now();

  return incomingTime >= existingTime;
}

// ===============================
// SAFE MAP SET
// ===============================
function safeSet(
  map: Map<string, any>,
  id: string,
  data: any
) {
  if (!id) return;

  const existing = map.get(id);

  if (existing && !isIncomingNewer(existing, data)) {
    return;
  }

  map.set(id, {
    ...existing,
    ...data,
  });

  trimMap(map);
}

// ===============================
// UPDATE CANDIDATE LOCAL
// ===============================
export function updateCandidateLocal(candidate: any) {
  const id = String(
    candidate?.id ??
      candidate?.candidate_id ??
      ""
  );

  if (!id) return;

  safeSet(cache.candidates, id, {
    ...candidate,
    id,
    updated_at:
      candidate?.updated_at ??
      new Date().toISOString(),
  });

  notifyUI();
}

// ===============================
// UPDATE TASK LOCAL
// ===============================
export function updateTaskLocal(task: any) {
  const id = String(
    task?.id ??
      task?.task_id ??
      ""
  );

  if (!id) return;

  safeSet(cache.tasks, id, {
    ...task,
    id,
    updated_at:
      task?.updated_at ??
      new Date().toISOString(),
  });

  notifyUI();
}

// ===============================
// GET UI STATE SNAPSHOT
// ===============================
export function getUIState() {
  return {
    candidates: Array.from(
      cache.candidates.values()
    ),
    tasks: Array.from(
      cache.tasks.values()
    ),
  };
}

// ===============================
// CLEAR CACHE
// ===============================
export function clearUIState() {
  cache.candidates.clear();
  cache.tasks.clear();
  processedEvents.clear();
  notifyUI();
}

// ===============================
// HYDRATE FROM SERVER
// ===============================
export async function hydrateUI(
  tenant_id: string
) {
  try {
    const normalizedTenant =
      tenant_id || "default";

    const [
      { data: candidates },
      { data: tasks },
    ] = await Promise.all([
      supabase
        .from("candidates")
        .select("*")
        .eq("tenant_id", normalizedTenant),

      supabase
        .from("tasks")
        .select("*")
        .eq("tenant_id", normalizedTenant),
    ]);

    cache.candidates.clear();
    cache.tasks.clear();

    (candidates || []).forEach((c) => {
      const id = String(c?.id);
      if (id) cache.candidates.set(id, c);
    });

    (tasks || []).forEach((t) => {
      const id = String(t?.id);
      if (id) cache.tasks.set(id, t);
    });

    trimMap(cache.candidates);
    trimMap(cache.tasks);

    notifyUI();
  } catch (err) {
    console.error("🔥 hydrateUI crashed:", err);
  }
}

// ===============================
// APPLY REALTIME PATCH
// ===============================
export function applyRealtimeUpdate(
  event: any
) {
  try {
    if (!event?.type || !event?.payload) return;

    const eventKey = getEventKey(event);

    if (processedEvents.has(eventKey)) return;

    safeAddEvent(eventKey);

    const payload = event.payload;

    // =========================
    // CANDIDATE EVENTS
    // =========================
    if (
      event.type === "CANDIDATE_STATUS_CHANGED" ||
      event.type === "CANDIDATE_UPDATED" ||
      event.type === "CANDIDATE_CREATED"
    ) {
      const candidateId = String(
        payload?.candidate_id ??
          payload?.id ??
          ""
      );

      if (!candidateId) return;

      safeSet(cache.candidates, candidateId, {
        ...payload,
        id: candidateId,
        updated_at:
          payload?.updated_at ??
          new Date().toISOString(),
      });
    }

    // =========================
    // TASK EVENTS
    // =========================
    if (
      event.type === "TASK_UPDATED" ||
      event.type === "TASK_CREATED"
    ) {
      const taskId = String(
        payload?.task_id ??
          payload?.id ??
          ""
      );

      if (!taskId) return;

      safeSet(cache.tasks, taskId, {
        ...payload,
        id: taskId,
        updated_at:
          payload?.updated_at ??
          new Date().toISOString(),
      });
    }

    notifyUI();
  } catch (err) {
    console.error("🔥 applyRealtimeUpdate crashed:", err);
  }
}