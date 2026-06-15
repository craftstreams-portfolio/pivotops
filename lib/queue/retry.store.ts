type QueuedEvent = {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  locked?: boolean;
  lockedAt?: number;
};

// ===============================
// IN-MEMORY QUEUE
// ===============================
const queue: Map<string, QueuedEvent> = new Map();

// ===============================
// ADD EVENT TO QUEUE
// ===============================
export function enqueueEvent(event: QueuedEvent) {
  if (!event?.id) {
    console.warn("⚠️ Cannot enqueue event without id");
    return;
  }

  const existing = queue.get(event.id);

  queue.set(event.id, {
    ...(existing || {}),
    ...event,
    attempts: event.attempts ?? existing?.attempts ?? 0,
    locked: false,
  });
}

// ===============================
// GET NEXT BATCH (UNLOCKED ONLY)
// ===============================
export function getNextBatch(limit: number): QueuedEvent[] {
  const batch: QueuedEvent[] = [];

  for (const event of queue.values()) {
    // skip locked or invalid events
    if (!event || event.locked) continue;

    batch.push(event);

    if (batch.length >= limit) break;
  }

  return batch;
}

// ===============================
// LOCK EVENT (SAFE + IDEMPOTENT)
// ===============================
export function lockEvent(id: string) {
  const event = queue.get(id);

  if (!event || event.locked) return false;

  queue.set(id, {
    ...event,
    locked: true,
    lockedAt: Date.now(),
  });

  return true;
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
  if (!queue.has(id)) return;

  queue.delete(id);
}

// ===============================
// OPTIONAL: DEBUG HELPERS (PHASE 4 SAFE)
// ===============================
export function getQueueSize() {
  return queue.size;
}

export function getQueueSnapshot() {
  return Array.from(queue.values());
}