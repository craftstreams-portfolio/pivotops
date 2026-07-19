import { getRedis } from "../redis/client";

// ===============================
// READ SNAPSHOT FAST PATH
// ===============================
export async function readSnapshot(
  tenant_id: string,
  timestamp: string
) {
  const redis = await getRedis();
  if (!redis) return null;          // no cache configured - caller rebuilds
  const key = `snapshot:${tenant_id}:${timestamp}`;
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data);
}