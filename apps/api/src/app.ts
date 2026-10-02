import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config.js";
import { checkDatabaseHealth } from "./db/health.js";
import type { Database } from "./db/client.js";
import { createCustomer, createCustomerInputSchema, listCustomers } from "./application/customers/customer-service.js";

export function buildApp(dependencies: { db: Database }) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug"
    },
    disableRequestLogging: false
  });

  app.register(helmet);
  app.register(cors, {
    origin: config.CORS_ORIGIN
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "ho-network-api"
  }));


  app.get("/api/v1/customers", async (_request, reply) => {
    const customers = await listCustomers(dependencies.db);
    return reply.send({ data: customers });
  });

  app.post("/api/v1/customers", async (request, reply) => {
    const parsed = createCustomerInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "بيانات العميل غير صالحة",
        issues: parsed.error.flatten()
      });
    }

    const customer = await createCustomer(dependencies.db, parsed.data);
    return reply.status(201).send({ data: customer });
  });

  app.get("/ready", async (_request, reply) => {
    const databaseReady = await checkDatabaseHealth(dependencies.db);

    if (!databaseReady) {
      return reply.status(503).send({
        status: "not_ready",
        dependencies: {
          database: "unavailable"
        }
      });
    }

    return reply.send({
      status: "ready",
      dependencies: {
        database: "ok"
      }
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

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
