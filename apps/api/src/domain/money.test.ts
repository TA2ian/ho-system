import assert from "node:assert/strict";
import test from "node:test";
import { currencyCode, Money } from "./money.js";

test("money arithmetic remains decimal-safe", () => {
  const usd = currencyCode("usd");
  const result = new Money("0.1", usd).add(new Money("0.2", usd));

  assert.equal(result.toString(), "0.3");
});

test("money rejects cross-currency arithmetic", () => {
  const usd = currencyCode("USD");
  const syp = currencyCode("SYP");

  assert.throws(
    () => new Money("10", usd).add(new Money("1", syp)),
    /Currency mismatch/
  );
});

test("currency codes are normalized and validated", () => {
  assert.equal(currencyCode(" usd "), "USD");
  assert.throws(() => currencyCode("US"), /Invalid currency code/);
});
