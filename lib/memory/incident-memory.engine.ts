import { getEventTrace } from "../events/event.trace";
import { EventTrace } from "../events/event.schema";

// ===============================
// TYPES
// ===============================
export type IncidentMemory = {
  pattern: string;
  frequency: number;
  affectedStages: string[];
  lastSeen: string;
};

// ===============================
// MEMORY ENGINE
// ===============================
export async function buildIncidentMemory(
  eventId: string
): Promise<IncidentMemory[]> {
  if (!eventId) throw new Error("eventId required");

  const traces: EventTrace[] = await getEventTrace(1000);

  const filtered = traces.filter((t) => t.eventId === eventId);

  const failureStages = filtered
    .filter((t) => t.stage.toUpperCase().includes("FAILED"))
    .map((t) => t.stage);

  const timeoutCount = filtered.filter((t) =>
    t.stage.toUpperCase().includes("TIMEOUT")
  ).length;

  const retryCount = filtered.filter((t) =>
    t.stage.toUpperCase().includes("RETRY")
  ).length;

  const memory: IncidentMemory[] = [];

  if (timeoutCount > 0) {
    memory.push({
      pattern: "timeout_pattern",
      frequency: timeoutCount,
      affectedStages: failureStages,
      lastSeen: new Date().toISOString(),
    });
  }

  if (retryCount > 2) {
    memory.push({
      pattern: "retry_loop",
      frequency: retryCount,
      affectedStages: failureStages,
      lastSeen: new Date().toISOString(),
    });
  }

  if (failureStages.length > 0) {
    memory.push({
      pattern: "failure_cluster",
      frequency: failureStages.length,
      affectedStages: failureStages,
      lastSeen: new Date().toISOString(),
    });
  }

  return memory;
}