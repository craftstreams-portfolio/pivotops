import { EventTrace } from "./event.schema";
import { getRedisOrNull } from "./redis.lazy";
const TRACE_KEY = "pivotops:event:trace";

// ===============================
// WRITE TRACE (STRICT EVENT TRACE)
// ===============================
export async function traceEvent(
  event: {
    id?: string;
    event_id?: string;
    type?: string;
    payload?: Record<string, unknown>;
  },
  stage: string,
  status: EventTrace["status"] = "success"
): Promise<void> {
  try {
    if (!event) return;

    const payload: EventTrace = {
      eventId: event.id ?? event.event_id ?? "unknown",
      type: event.type ?? "unknown",
      stage,
      status,
      payload: event.payload ?? {},
      timestamp: Date.now(),
    };

    const redis = await getRedisOrNull();
    if (!redis) return;
    await redis.lPush(TRACE_KEY, JSON.stringify(payload));
  } catch (err: unknown) {
    console.error("❌ traceEvent failed:", err);
  }
}

// ===============================
// READ TRACE (GLOBAL SCAN - SAFE)
// ===============================
export async function getEventTrace(
  limit: number = 100
): Promise<EventTrace[]> {
  try {
    const redis = await getRedisOrNull();
    if (!redis) return [];
    const items = await redis.lRange(TRACE_KEY, 0, limit - 1);

    return items
      .map((i: string) => {
        try {
          return JSON.parse(i) as EventTrace;
        } catch {
          return null;
        }
      })
      .filter((t): t is EventTrace => t !== null);
  } catch (err: unknown) {
    console.error("❌ getEventTrace failed:", err);
    return [];
  }
}

// ===============================
// READ TRACE BY EVENT ID (FIX FOR INCIDENT BUILDER)
// ===============================
export async function getEventTraceByEventId(
  eventId: string
): Promise<EventTrace[]> {
  try {
    if (!eventId) return [];

    const redis = await getRedisOrNull();
    if (!redis) return [];
    const items = await redis.lRange(TRACE_KEY, 0, -1);

    return items
      .map((i: string) => {
        try {
          return JSON.parse(i) as EventTrace;
        } catch {
          return null;
        }
      })
      .filter((t): t is EventTrace => t !== null)
      .filter((t) => t.eventId === eventId);
  } catch (err: unknown) {
    console.error("❌ getEventTraceByEventId failed:", err);
    return [];
  }
}