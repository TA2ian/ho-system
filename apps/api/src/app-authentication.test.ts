import assert from "node:assert/strict";
import { test } from "node:test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const { buildApp } = await import("./app.js");
import { InvalidAuthenticationError, type AuthenticationAdapter } from "./identity/auth.js";

test("protected routes reject missing credentials", async () => {
  const adapter: AuthenticationAdapter = {
    async verifyCredential() {
      throw new Error("should not be called");
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
  assert.equal(response.json().error, "UNAUTHORIZED");
  await app.close();
});

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
