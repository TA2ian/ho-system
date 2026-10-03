import assert from "node:assert/strict";
import { test } from "node:test";
import { hashRequestBody } from "./idempotency.js";

test("idempotency hashes object keys canonically", () => {
  assert.equal(
    hashRequestBody({ amount: "10.00", currencyCode: "AED", nested: { b: 2, a: 1 } }),
    hashRequestBody({ nested: { a: 1, b: 2 }, currencyCode: "AED", amount: "10.00" })
  );
});

test("idempotency preserves array order", () => {
  assert.notEqual(
    hashRequestBody({ items: ["a", "b"] }),
    hashRequestBody({ items: ["b", "a"] })
  );
});

test("idempotency distinguishes values with different types", () => {
  assert.notEqual(hashRequestBody({ value: "1" }), hashRequestBody({ value: 1 }));
  assert.notEqual(hashRequestBody(null), hashRequestBody({}));
});

test("idempotency hashing is deterministic for nested request payloads", () => {
  const payload = {
    customerId: "00000000-0000-0000-0000-000000000001",
    lines: [
      { quantity: "2", unitPrice: "12.50", metadata: { source: "api", retry: false } }
    ],
    notes: null
  };
  assert.equal(hashRequestBody(payload), hashRequestBody(payload));
});
