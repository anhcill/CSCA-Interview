import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env.js";

const memoryCache = new Map<string, { expiresAt: number; payload: unknown }>();
let redisClientPromise: Promise<RedisClientType | null> | null = null;
let redisStatus: "disabled" | "error" | "ok" = env.redisUrl ? "error" : "disabled";

async function getRedisClient() {
  if (!env.redisUrl) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient({ url: env.redisUrl });
        client.on("error", (error) => {
          redisStatus = "error";
          console.warn("[CACHE] Redis error", error.message);
        });
        await client.connect();
        redisStatus = "ok";
        console.log("[CACHE] Redis connected");
        return client as RedisClientType;
      } catch (error) {
        redisStatus = "error";
        console.warn("[CACHE] Redis unavailable, using memory cache", error instanceof Error ? error.message : error);
        return null;
      }
    })();
  }
  return redisClientPromise;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  if (redis) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) as T : null;
  }

  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.payload as T;
}

export async function setCachedJson(key: string, payload: unknown, ttlMs: number) {
  const redis = await getRedisClient();
  if (redis) {
    await redis.set(key, JSON.stringify(payload), { PX: ttlMs });
    return;
  }

  memoryCache.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

export function getCacheStatus() {
  return {
    entries: memoryCache.size,
    redis: redisStatus,
    status: redisStatus === "ok" ? "redis" : "memory"
  };
}
