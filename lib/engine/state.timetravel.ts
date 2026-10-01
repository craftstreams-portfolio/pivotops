import { readSnapshot } from "./snapshot.reader";
import { rebuildFromEvents } from "./state.rebuilder";

// ===============================
// HYBRID TIME TRAVEL ENGINE
// ===============================
export async function rebuildStateAt(
  timestamp: string,
  tenant_id = "default"
) {
  const safeTimestamp = new Date(timestamp).toISOString();

  const cached = await readSnapshot(
    tenant_id,
    safeTimestamp
  );

  if (cached) {
    console.log("⚡ Snapshot hit (Redis)");
    return cached;
  }

  console.log("🔁 Rebuilding from events...");

  const state = await rebuildFromEvents(
    safeTimestamp,
    tenant_id
  );

  return state;
}