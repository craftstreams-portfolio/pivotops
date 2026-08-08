type QueuedEvent = {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  locked?: boolean;
  lockedAt?: number;
};

// ===============================
// IN-MEMORY QUEUE (PHASE 4 SIMPLE)
// ===============================
const queue: Map<string, QueuedEvent> = new Map();

// ===============================
// ADD EVENT TO QUEUE
// ===============================
export function enqueueEvent(event: QueuedEvent) {
  queue.set(event.id, {
    ...event,
    attempts: event.attempts ?? 0,
    locked: false,
  });
}

// ===============================
// GET NEXT BATCH (UNLOCKED ONLY)
// ===============================
export function getNextBatch(limit: number): QueuedEvent[] {
  const batch: QueuedEvent[] = [];

  for (const event of queue.values()) {
    if (!event.locked) {
      batch.push(event);
    }

    if (batch.length >= limit) break;
  }

  return batch;
}

// ===============================
// LOCK EVENT (SAFE ATOMIC GUARD)
// ===============================
export function lockEvent(id: string) {
  const event = queue.get(id);
  if (!event) return;

  queue.set(id, {
    ...event,
    locked: true,
    lockedAt: Date.now(),
  });
}

// ===============================
// UNLOCK EVENT
// ===============================
export function unlockEvent(id: string) {
  const event = queue.get(id);
  if (!event) return;

  queue.set(id, {
    ...event,
    locked: false,
    lockedAt: undefined,
  });
}

// ===============================
// REMOVE EVENT (SUCCESS CLEANUP)
// ===============================
export function removeEvent(id: string) {
  queue.delete(id);
}

// ===============================
// OPTIONAL: SAFETY UTIL (PREVENT DUPES)
// ===============================
const processed = new Set<string>();

export function isDuplicateEvent(id: string) {
  if (processed.has(id)) return true;
  processed.add(id);
  return false;
}