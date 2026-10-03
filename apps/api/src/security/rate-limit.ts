type Bucket = {
  windowStartedAt: number;
  count: number;
};

export type RateLimiter = {
  assert(key: string): void;
  reset(): void;
};

export function createRateLimiter(
  maxRequests: number,
  windowSeconds: number
): RateLimiter {
  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new Error("Invalid maxRequests");
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("Invalid windowSeconds");
  }

  const buckets = new Map<string, Bucket>();
  const windowMs = windowSeconds * 1000;

  function prune(now: number): void {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStartedAt >= windowMs) buckets.delete(key);
    }
  }

  return {
    assert(key: string): void {
      const normalizedKey = key.trim();
      if (!normalizedKey) throw new Error("RATE_LIMIT_KEY_REQUIRED");

      const now = Date.now();
      prune(now);

      const existing = buckets.get(normalizedKey);
      if (!existing) {
        buckets.set(normalizedKey, { windowStartedAt: now, count: 1 });
        return;
      }

      if (existing.count >= maxRequests) throw new Error("RATE_LIMITED");
      existing.count += 1;
    },
    reset(): void {
      buckets.clear();
    }
  };
}
