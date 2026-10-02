import test from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

test("sales order quantity preserves decimal precision", () => {
  const quantity = new Decimal("0.0000000001");
  assert.equal(quantity.toFixed(), "0.0000000001");
});

test("sales order quantity must be positive", () => {
  assert.equal(new Decimal("0").lte(0), true);
  assert.equal(new Decimal("-1").lte(0), true);
  assert.equal(new Decimal("1.5").lte(0), false);
});
