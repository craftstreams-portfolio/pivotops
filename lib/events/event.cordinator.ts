import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

const COORD_KEY = "pivotops:event:coordinator";

// ===============================
// REGISTER WORKER HEARTBEAT
// ===============================
export async function registerWorker(workerId: string) {
  await redis.hSet(COORD_KEY, workerId, Date.now().toString());
}

// ===============================
// CHECK ACTIVE WORKERS
// ===============================
export async function getActiveWorkers() {
  return await redis.hGetAll(COORD_KEY);
}

// ===============================
// REMOVE DEAD WORKERS
// ===============================
export async function cleanupWorkers(timeoutMs = 30000) {
  const workers = await getActiveWorkers();

  const now = Date.now();

  for (const [workerId, lastSeen] of Object.entries(workers)) {
    if (now - Number(lastSeen) > timeoutMs) {
      await redis.hDel(COORD_KEY, workerId);
    }
  }
}