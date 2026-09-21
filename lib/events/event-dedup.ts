const recentEvents = new Map<string, number>();

const WINDOW_MS = 5000; // 5 seconds

export function isDuplicateEvent(key: string) {
  const now = Date.now();
  const last = recentEvents.get(key);

  if (last && now - last < WINDOW_MS) {
    return true;
  }

  recentEvents.set(key, now);
  return false;
}