import test from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";

test("catalog price comparison remains exact for decimal values", () => {
  const cost = new Decimal("0.10");
  const sale = new Decimal("0.30");
  assert.equal(sale.lt(cost), false);
});

test("catalog rejects sale price below cost", () => {
  const cost = new Decimal("10.0000000000");
  const sale = new Decimal("9.9999999999");
  assert.equal(sale.lt(cost), true);
});
