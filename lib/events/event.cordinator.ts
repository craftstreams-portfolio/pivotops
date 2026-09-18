import { getRedisOrNull } from "./redis.lazy";

const COORD_KEY = "pivotops:event:coordinator";

export async function registerWorker(workerId: string) {
  const redis = await getRedisOrNull();
  if (!redis) return;
  await redis.hSet(COORD_KEY, workerId, Date.now().toString());
}

export async function getActiveWorkers(): Promise<Record<string, string>> {
  const redis = await getRedisOrNull();
  if (!redis) return {};
  return await redis.hGetAll(COORD_KEY);
}

export async function cleanupWorkers(timeoutMs = 30000) {
  const redis = await getRedisOrNull();
  if (!redis) return;
  const workers = await getActiveWorkers();
  const now = Date.now();
  for (const [workerId, lastSeen] of Object.entries(workers)) {
    if (now - Number(lastSeen) > timeoutMs) {
      await redis.hDel(COORD_KEY, workerId);
    }
  }
}