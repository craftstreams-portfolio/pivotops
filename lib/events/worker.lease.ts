import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

const LEASE_PREFIX = "pivotops:lease:";
const LEASE_TTL = 30000; // 30s

// ===============================
// ACQUIRE LEASE
// ===============================
export async function acquireLease(eventId: string, workerId: string) {
  const key = `${LEASE_PREFIX}${eventId}`;

  const result = await redis.set(key, workerId, {
    NX: true,
    PX: LEASE_TTL,
  });

  return result === "OK";
}

// ===============================
// EXTEND LEASE (HEARTBEAT)
// ===============================
export async function extendLease(eventId: string, workerId: string) {
  const key = `${LEASE_PREFIX}${eventId}`;

  const current = await redis.get(key);

  if (current !== workerId) return false;

  await redis.pexpire(key, LEASE_TTL);
  return true;
}

// ===============================
// RELEASE LEASE
// ===============================
export async function releaseLease(eventId: string) {
  await redis.del(`${LEASE_PREFIX}${eventId}`);
}

// ===============================
// CHECK LEASE OWNER
// ===============================
export async function getLeaseOwner(eventId: string) {
  return await redis.get(`${LEASE_PREFIX}${eventId}`);
}