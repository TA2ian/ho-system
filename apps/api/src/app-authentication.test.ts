import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "./app.js";
import { InvalidAuthenticationError, type AuthenticationAdapter } from "./identity/auth.js";

test("protected routes stop after authentication failure", async () => {
  let routeReached = false;
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

  app.post("/api/v1/test-auth-stop", async () => {
    routeReached = true;
    return { reached: true };
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/test-auth-stop"
  });

  assert.equal(response.statusCode, 401);
  assert.equal(routeReached, false);
  await app.close();
});
