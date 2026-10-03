import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryStatusSchema, deliveryTypeSchema } from "./delivery.js";

test("delivery types accept only internal and external", () => {
  assert.equal(deliveryTypeSchema.parse("internal"), "internal");
  assert.equal(deliveryTypeSchema.parse("external"), "external");
  assert.throws(() => deliveryTypeSchema.parse("third_party"));
});

test("delivery statuses preserve the complete lifecycle vocabulary", () => {
  for (const status of ["pending","assigned","out_for_delivery","delivered","failed","returned","cancelled"]) {
    assert.equal(deliveryStatusSchema.parse(status), status);
  }
  assert.throws(() => deliveryStatusSchema.parse("completed"));
});
