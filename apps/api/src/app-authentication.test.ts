import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "./app.js";
import { InvalidAuthenticationError, type AuthenticationAdapter } from "./identity/auth.js";

test("protected routes stop after authentication failure", async () => {
  const adapter: AuthenticationAdapter = {
    async verifyCredential() {
      throw new InvalidAuthenticationError();
    }
  };

  const app = buildApp({
    db: {} as never,
    pool: {} as never,
    authAdapter: adapter
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/customers"
  });

  assert.equal(response.statusCode, 401);
  await app.close();
});
