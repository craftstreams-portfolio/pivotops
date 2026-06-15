import { createClient } from "redis";

// ===============================
// REDIS CLIENT SINGLETON
// ===============================
export const redis = createClient({
  url: process.env.REDIS_URL,
});

let connected = false;

export async function getRedis() {
  if (!connected) {
    await redis.connect();
    connected = true;
    console.log("⚡ Redis connected");
  }

  return redis;
}