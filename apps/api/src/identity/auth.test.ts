import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPermission, hasPermission, hasScope, type AuthenticatedPrincipal } from "./auth.js";

const principal: AuthenticatedPrincipal = {
  userId: "00000000-0000-0000-0000-000000000001",
  provider: "test",
  subject: "subject",
  roles: new Set(["operator"]),
  permissions: new Set(["sales.manage"]),
  scopes: new Set(["campaign:00000000-0000-0000-0000-000000000002"])
};

test("permission checks fail closed", () => {
  assert.equal(hasPermission(principal, "sales.manage"), true);
  assert.equal(hasPermission(principal, "accounting.journal.post"), false);
  assert.doesNotThrow(() => assertPermission(principal, "sales.manage"));
  assert.throws(() => assertPermission(principal, "accounting.journal.post"), /FORBIDDEN/);
});

test("resource scopes are exact-match", () => {
  assert.equal(hasScope(principal, "campaign", "00000000-0000-0000-0000-000000000002"), true);
  assert.equal(hasScope(principal, "campaign", "00000000-0000-0000-0000-000000000003"), false);
  assert.equal(hasScope(principal, "customer", "00000000-0000-0000-0000-000000000002"), false);
});
