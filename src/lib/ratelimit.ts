import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';

let limiter: Ratelimit | null | undefined;

export function getRateLimiter() {
  if (limiter !== undefined) {
    return limiter;
  }

  const redis = getRedis();
  if (!redis) {
    limiter = null;
    return limiter;
  }

  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
  });
  return limiter;
}

export async function checkRateLimit(key: string) {
  const rateLimiter = getRateLimiter();
  if (!rateLimiter) {
    return { success: true };
  }

  return rateLimiter.limit(key);
}

