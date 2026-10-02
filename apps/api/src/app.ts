import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config.js";

export function buildApp() {
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

  app.get("/ready", async (_request, reply) => {
    // Database readiness will be wired in Phase 1.
    return reply.send({ status: "ready" });
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
