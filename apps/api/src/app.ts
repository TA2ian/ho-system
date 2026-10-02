import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { Pool } from "pg";
import { config } from "./config.js";
import { checkDatabaseHealth } from "./db/health.js";
import type { Database } from "./db/client.js";
import { withTransaction } from "./db/transaction.js";
import { createCustomer, createCustomerInputSchema, listCustomers } from "./application/customers/customer-service.js";
import { beginIdempotency, completeIdempotency, hashRequestBody } from "./application/idempotency.js";
import { assertPermission } from "./identity/auth.js";
import type { AuthenticationAdapter } from "./identity/auth.js";
import { registerAuthentication } from "./identity/middleware.js";
import { ApplicationError } from "./domain/errors.js";

export function buildApp(dependencies: {
  db: Database;
  pool: Pool;
  authAdapter: AuthenticationAdapter;
}) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug"
    },
    disableRequestLogging: false
  });

  app.register(helmet);
  app.register(cors, { origin: config.CORS_ORIGIN });

  app.decorateRequest("principal", null);

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health" || request.url === "/ready") return;
    registerAuthentication(request, reply, {
      db: dependencies.db,
      adapter: dependencies.authAdapter
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "ho-network-api"
  }));

  app.get("/api/v1/customers", async (request, reply) => {
    if (!request.principal) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    }
    try {
      assertPermission(request.principal, "customers.read");
      const customerRows = await listCustomers(dependencies.db);
      return reply.send({ data: customerRows });
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return reply.status(403).send({ error: "FORBIDDEN", message: "ليس لديك صلاحية الوصول إلى العملاء" });
      }
      throw error;
    }
  });

  app.post("/api/v1/customers", async (request, reply) => {
    if (!request.principal) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    }

    const parsed = createCustomerInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "بيانات العميل غير صالحة",
        issues: parsed.error.flatten()
      });
    }

    try {
      assertPermission(request.principal, "customers.write");
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return reply.status(403).send({ error: "FORBIDDEN", message: "ليس لديك صلاحية إنشاء العملاء" });
      }
      throw error;
    }

    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "يجب إرسال مفتاح Idempotency-Key صالح"
      });
    }

    const scope = `customer:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, idempotencyKey.trim(), requestHash);

      if (idem.kind === "replay") {
        return idem;
      }

      if (idem.kind === "conflict") {
        throw new ApplicationError(
          idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
          409,
          idem.reason === "KEY_REUSED"
            ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة"
            : "الطلب نفسه قيد المعالجة"
        );
      }

      const customer = await createCustomer(tx, parsed.data, {
        actorId: request.principal!.userId,
        requestId: request.id,
        idempotencyKey: idempotencyKey.trim()
      });

      const body = { data: customer };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });

    return reply.status(result.kind === "replay" ? result.status : result.status).send(result.body);
  });

  app.get("/ready", async (_request, reply) => {
    const databaseReady = await checkDatabaseHealth(dependencies.db);
    if (!databaseReady) {
      return reply.status(503).send({
        status: "not_ready",
        dependencies: { database: "unavailable" }
      });
    }
    return reply.send({
      status: "ready",
      dependencies: { database: "ok" }
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error instanceof ApplicationError) {
      return reply.status(error.status).send({
        error: error.code,
        message: error.message
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: "REQUEST_ERROR",
        message: error.message
      });
    }

    return reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "حدث خطأ داخلي في الخادم"
    });
  });

  return app;
}
