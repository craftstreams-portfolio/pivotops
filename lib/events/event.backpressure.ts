import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

const LOAD_KEY = "pivotops:event:load";

export async function increaseLoad() {
  await redis.incr(LOAD_KEY);
}

export async function decreaseLoad() {
  await redis.decr(LOAD_KEY);
}

export async function getLoad() {
  const load = await redis.get(LOAD_KEY);
  return Number(load ?? 0);
}

export async function shouldThrottle(max = 50) {
  const load = await getLoad();
  return load > max;
}