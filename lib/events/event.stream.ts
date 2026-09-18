import { EventTrace } from "./event.schema";

// ===============================
// MOCK / DB ACCESS LAYER CONTRACT
// ===============================

// OLD PROBLEM:
// getEventTrace(1000) → unsafe full scan

// ===============================
// FIXED: SINGLE EVENT FETCH
// ===============================
export async function getEventTraceByEventId(
  eventId: string
): Promise<EventTrace[]> {
  if (!eventId) {
    throw new Error("eventId is required");
  }

  // NOTE:
  // Replace this with DB query (Supabase / Postgres / etc)

  const traces: EventTrace[] = [];

  return traces.filter(
    (t) => t.eventId === eventId
  );
}