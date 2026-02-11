import { Redis } from '@upstash/redis';

let cached: Redis | null | undefined;

export function getRedis() {
  if (cached !== undefined) {
    return cached;
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    cached = null;
    return cached;
  }

  cached = Redis.fromEnv();
  return cached;
}

