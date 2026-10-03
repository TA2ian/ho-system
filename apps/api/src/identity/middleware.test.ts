import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidAuthenticationError, type AuthenticationAdapter } from "./auth.js";
import { authenticateRequest } from "./middleware.js";

function replyRecorder() {
  const state = { status: 200, body: undefined as unknown };
  return {
    state,
    code(status: number) {
      state.status = status;
      return this;
    },
    send(body: unknown) {
      state.body = body;
      return this;
    }
  };
}

function request(headers: Record<string, string | undefined> = {}) {
  return { headers, principal: null };
}

test("authentication rejects missing credentials and stops the pipeline", async () => {
  let called = false;
  const adapter: AuthenticationAdapter = {
    async verifyCredential() {
      called = true;
      throw new Error("must not be called");
    }
  };
  const reply = replyRecorder();

  const authenticated = await authenticateRequest(
      request() as never,
    reply as never,
    { db: {} as never, adapter }
  );

  assert.equal(authenticated, false);
  assert.equal(called, false);
  assert.equal(reply.state.status, 401);
});

test("invalid credentials become 401 without hiding infrastructure failures", async () => {
  const invalidAdapter: AuthenticationAdapter = {
    async verifyCredential() {
      throw new InvalidAuthenticationError();
    }
  };
  const invalidReply = replyRecorder();

  assert.equal(
    await authenticateRequest(
      request({ authorization: "Bearer invalid" }) as never,
      invalidReply as never,
      { db: {} as never, adapter: invalidAdapter }
    ),
    false
  );
  assert.equal(invalidReply.state.status, 401);

  const infrastructureError = new Error("database unavailable");
  const failingAdapter: AuthenticationAdapter = {
    async verifyCredential() {
      throw infrastructureError;
    }
  };
  const failingReply = replyRecorder();

  await assert.rejects(
    authenticateRequest(
      request({ authorization: "Bearer credential" }) as never,
      failingReply as never,
      { db: {} as never, adapter: failingAdapter }
    ),
    infrastructureError
  );
  assert.equal(failingReply.state.status, 200);
});

test("unknown identities return 401", async () => {
  const adapter: AuthenticationAdapter = {
    async verifyCredential() {
      return { provider: "test", subject: "missing-user" };
    }
  };
  const reply = replyRecorder();
  const db = {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return {
                innerJoin() {
                  return {
                    leftJoin() {
                      return {
                        leftJoin() {
                          return {
                            where: async () => []
                          };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  assert.equal(
    await authenticateRequest(
      request({ authorization: "Bearer credential" }) as never,
      reply as never,
      { db: db as never, adapter }
    ),
    false
  );
  assert.equal(reply.state.status, 401);
});
