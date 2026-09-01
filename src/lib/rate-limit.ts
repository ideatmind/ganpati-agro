/**
 * Small in-memory limiter for server routes. This is per instance by design;
 * use an external store when the application is deployed across many workers.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  function evictExpired(now: number) {
    for (const [key, times] of hits) {
      const active = times.filter((time) => now - time < windowMs);
      if (active.length) hits.set(key, active);
      else hits.delete(key);
    }
  }

  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      evictExpired(now);
      const times = hits.get(key) ?? [];
      if (times.length >= limit) return true;
      hits.set(key, [...times, now]);
      return false;
    },
  };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
