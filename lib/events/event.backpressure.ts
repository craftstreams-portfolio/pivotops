import { getRedisOrNull } from "./redis.lazy";

const LOAD_KEY = "pivotops:event:load";

export async function increaseLoad() {
  const redis = await getRedisOrNull();
  if (!redis) return;
  await redis.incr(LOAD_KEY);
}

export async function decreaseLoad() {
  const redis = await getRedisOrNull();
  if (!redis) return;
  await redis.decr(LOAD_KEY);
}

export async function getLoad() {
  const redis = await getRedisOrNull();
  if (!redis) return 0;
  const load = await redis.get(LOAD_KEY);
  return Number(load ?? 0);
}

/** Without Redis there is no shared load signal, so never throttle. */
export async function shouldThrottle(max = 50) {
  const load = await getLoad();
  return load > max;
}