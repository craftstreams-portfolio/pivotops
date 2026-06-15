import { getRedis } from "../redis/client";

// ===============================
// WRITE SNAPSHOT TO REDIS
// ===============================
export async function writeSnapshot(
  tenant_id: string,
  timestamp: string,
  state: any
) {
  const redis = await getRedis();

  const key = `snapshot:${tenant_id}:${timestamp}`;

  await redis.set(key, JSON.stringify(state), {
    EX: 60 * 60 * 24, // 24h TTL
  });
}