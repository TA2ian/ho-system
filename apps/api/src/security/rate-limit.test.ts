import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "./rate-limit.js";

test("rate limiter rejects after the configured request count", () => {
  const limiter = createRateLimiter(2, 60);

  limiter.assert("user-1");
  limiter.assert("user-1");

  assert.throws(
    () => limiter.assert("user-1"),
    (error: unknown) => error instanceof Error && error.message === "RATE_LIMITED"
  );

  limiter.assert("user-2");
});

test("rate limiter rejects blank keys", () => {
  const limiter = createRateLimiter(1, 60);

  assert.throws(
    () => limiter.assert("   "),
    (error: unknown) => error instanceof Error && error.message === "RATE_LIMIT_KEY_REQUIRED"
  );
});

test("rate limiter reset clears all buckets", () => {
  const limiter = createRateLimiter(1, 60);

  limiter.assert("user-1");
  limiter.reset();
  limiter.assert("user-1");
});
