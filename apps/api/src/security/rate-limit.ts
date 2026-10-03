import { config } from "../config.js";

type Bucket = {
  windowStartedAt: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

export function assertUserRateLimit(userId: string): void {
  const now = Date.now();
  const windowMs = config.RATE_LIMIT_WINDOW_SECONDS * 1000;
  const existing = buckets.get(userId);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    buckets.set(userId, { windowStartedAt: now, count: 1 });
    return;
  }

  if (existing.count >= config.RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("RATE_LIMITED");
  }

  existing.count += 1;
}

export function resetRateLimitState(): void {
  buckets.clear();
}
