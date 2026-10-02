import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
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
import { authenticateRequest } from "./identity/middleware.js";
import { ApplicationError } from "./domain/errors.js";
import { createCatalogItem, createCatalogItemInputSchema, listCatalogCategories, listCatalogItems } from "./application/catalog/catalog-service.js";
import { createSalesOrder, createSalesOrderInputSchema, getSalesOrder, transitionSalesOrder } from "./application/sales-orders/sales-order-service.js";
import { createInvoiceFromSalesOrder, createInvoiceInputSchema, getInvoice, issueInvoice } from "./application/invoices/invoice-service.js";
import { allocatePayment, allocatePaymentInputSchema, createPayment, createPaymentInputSchema, getPayment, reversePayment, reversePaymentInputSchema } from "./application/payments/payment-service.js";
import { addCollectionPayment, addCollectionPaymentInputSchema, closeCollection, closeCollectionInputSchema, getCollection, openCollection, openCollectionInputSchema } from "./application/driver-collections/collection-service.js";
import { getInvoiceReceivable, listCustomerReceivables } from "./application/receivables/receivable-service.js";
import { assignDeliveryOrder, assignDeliveryOrderInputSchema, createDeliveryOrder, createDeliveryOrderInputSchema, getDeliveryOrder, listDeliveryOrders, transitionDeliveryOrder, transitionDeliveryOrderInputSchema } from "./application/delivery/delivery-service.js";
import { campaignStatusInputSchema, createCampaign, createCampaignInputSchema, getCampaign, linkCampaignInvoice, linkCampaignInvoiceInputSchema, listCampaigns, recordCampaignSpend, recordCampaignSpendInputSchema, transitionCampaign } from "./application/campaigns/campaign-service.js";

export function buildApp(dependencies: {
  db: Database;
  pool: Pool;
  authAdapter: AuthenticationAdapter;
}) {
  const app = Fastify({
    logger: { level: config.NODE_ENV === "production" ? "info" : "debug" },
    disableRequestLogging: false
  });

  app.register(helmet);
  app.register(cors, { origin: config.CORS_ORIGIN });
  app.decorateRequest("principal", null);

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health" || request.url === "/ready") return;
    await authenticateRequest(request, reply, {
      db: dependencies.db,
      adapter: dependencies.authAdapter
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "ho-network-api"
  }));

  app.get("/api/v1/customers", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });

    assertPermission(request.principal, "customers.read");
    const customerRows = await listCustomers(dependencies.db);
    return reply.send({ data: customerRows });
  });

  app.post("/api/v1/customers", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });

    const parsed = createCustomerInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "بيانات العميل غير صالحة",
        issues: parsed.error.flatten()
      });
    }

    assertPermission(request.principal, "customers.write");

    const idempotencyKey = request.headers["idempotency-key"];
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.trim().length < 16 ||
      idempotencyKey.length > 255
    ) {
      return reply.status(400).send({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "يجب إرسال مفتاح Idempotency-Key صالح"
      });
    }

    const key = idempotencyKey.trim();
    const scope = `customer:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);

      if (idem.kind === "replay") return idem;

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
        idempotencyKey: key
      });

      const body = { data: customer };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });

    return reply.status(result.status).send(result.body);
  });

  app.get("/api/v1/catalog/categories", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });
    assertPermission(request.principal, "catalog.read");
    return reply.send({ data: await listCatalogCategories(dependencies.db) });
  });

  app.get("/api/v1/catalog/items", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });
    assertPermission(request.principal, "catalog.read");
    return reply.send({ data: await listCatalogItems(dependencies.db) });
  });

  app.post("/api/v1/catalog/items", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });

    assertPermission(request.principal, "catalog.manage");

    const parsed = createCatalogItemInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "بيانات عنصر الكتالوج غير صالحة",
        issues: parsed.error.flatten()
      });
    }

    const idempotencyKey = request.headers["idempotency-key"];
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.trim().length < 16 ||
      idempotencyKey.length > 255
    ) {
      return reply.status(400).send({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "يجب إرسال مفتاح Idempotency-Key صالح"
      });
    }

    const key = idempotencyKey.trim();
    const scope = `catalog:item:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;

      if (idem.kind === "conflict") {
        throw new ApplicationError(
          idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
          409,
          idem.reason === "KEY_REUSED"
            ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة"
            : "الطلب نفسه قيد المعالجة"
        );
      }

      const item = await createCatalogItem(tx, parsed.data, {
        actorId: request.principal!.userId,
        requestId: request.id,
        idempotencyKey: key
      });

      const body = { data: item };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });

    return reply.status(result.status).send(result.body);
  });

  app.post("/api/v1/sales-orders", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });

    assertPermission(request.principal, "sales.manage");

    const parsed = createSalesOrderInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "بيانات طلب البيع غير صالحة",
        issues: parsed.error.flatten()
      });
    }

    const idempotencyKey = request.headers["idempotency-key"];
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.trim().length < 16 ||
      idempotencyKey.length > 255
    ) {
      return reply.status(400).send({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "يجب إرسال مفتاح Idempotency-Key صالح"
      });
    }

    const key = idempotencyKey.trim();
    const scope = `sales-order:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;

      if (idem.kind === "conflict") {
        throw new ApplicationError(
          idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
          409,
          idem.reason === "KEY_REUSED"
            ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة"
            : "الطلب نفسه قيد المعالجة"
        );
      }

      const created = await createSalesOrder(tx, parsed.data, {
        actorId: request.principal!.userId,
        requestId: request.id,
        idempotencyKey: key
      });

      const body = { data: created };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });

    return reply.status(result.status).send(result.body);
  });

  app.get<{ Params: { id: string } }>("/api/v1/sales-orders/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });

    assertPermission(request.principal, "sales.manage");

    const params = request.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(params.id)) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "معرّف طلب البيع غير صالح"
      });
    }

    return reply.send({ data: await getSalesOrder(dependencies.db, params.id) });
  });

  async function handleSalesOrderTransition(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    target: "confirmed" | "cancelled"
  ) {
    if (!request.principal) return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });

    assertPermission(request.principal, "sales.manage");

    const params = request.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(params.id)) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "معرّف طلب البيع غير صالح"
      });
    }

    const idempotencyKey = request.headers["idempotency-key"];
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.trim().length < 16 ||
      idempotencyKey.length > 255
    ) {
      return reply.status(400).send({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "يجب إرسال مفتاح Idempotency-Key صالح"
      });
    }

    const key = idempotencyKey.trim();
    const scope = `sales-order:${target}:${params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody({ orderId: params.id, target });

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;

      if (idem.kind === "conflict") {
        throw new ApplicationError(
          idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
          409,
          idem.reason === "KEY_REUSED"
            ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة"
            : "الطلب نفسه قيد المعالجة"
        );
      }

      const updated = await transitionSalesOrder(tx, params.id!, target, {
        actorId: request.principal!.userId,
        requestId: request.id,
        idempotencyKey: key
      });

      const body = { data: updated };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });

    return reply.status(result.status).send(result.body);
  }

  app.post<{ Params: { id: string } }>("/api/v1/sales-orders/:id/confirm", async (request, reply) => {
    return handleSalesOrderTransition(request, reply, "confirmed");
  });

  app.post<{ Params: { id: string } }>("/api/v1/sales-orders/:id/cancel", async (request, reply) => {
    return handleSalesOrderTransition(request, reply, "cancelled");
  });

  app.get<{ Params: { id: string } }>("/api/v1/invoices/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "invoices.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الفاتورة غير صالح" });
    }
    return reply.send({ data: await getInvoice(dependencies.db, request.params.id) });
  });

  app.post("/api/v1/invoices", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "invoices.manage");
    const parsed = createInvoiceInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات الفاتورة غير صالحة", issues: parsed.error.flatten() });

    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `invoice:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(
        idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
        409,
        idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة"
      );
      const created = await createInvoiceFromSalesOrder(tx, parsed.data, {
        actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key
      });
      const body = { data: created };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/invoices/:id/issue", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "invoices.manage");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الفاتورة غير صالح" });
    }
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `invoice:issue:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody({ invoiceId: request.params.id, action: "issue" });

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(
        idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
        409,
        idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة"
      );
      const issued = await issueInvoice(tx, request.params.id, {
        actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key
      });
      const body = { data: issued };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.get<{ Params: { id: string } }>("/api/v1/receivables/invoices/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "receivables.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الفاتورة غير صالح" });
    }
    return reply.send({ data: await getInvoiceReceivable(dependencies.db, request.params.id) });
  });

  app.get<{ Params: { customerId: string } }>("/api/v1/receivables/customers/:customerId", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "receivables.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.customerId)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف العميل غير صالح" });
    }
    return reply.send({ data: await listCustomerReceivables(dependencies.db, request.params.customerId) });
  });

  app.get<{ Params: { id: string } }>("/api/v1/payments/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "payments.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الدفعة غير صالح" });
    }
    return reply.send({ data: await getPayment(dependencies.db, request.params.id) });
  });

  app.post("/api/v1/payments", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "payments.manage");
    const parsed = createPaymentInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات الدفعة غير صالحة", issues: parsed.error.flatten() });

    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `payment:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(
        idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
        409,
        idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة"
      );
      const created = await createPayment(tx, parsed.data, {
        actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key
      });
      const body = { data: created };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/payments/:id/allocate", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "payments.manage");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الدفعة غير صالح" });
    }
    const parsed = allocatePaymentInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات تخصيص الدفعة غير صالحة", issues: parsed.error.flatten() });

    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `payment:allocate:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(
        idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
        409,
        idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة"
      );
      const allocated = await allocatePayment(tx, request.params.id, parsed.data, {
        actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key
      });
      const body = { data: allocated };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/payments/:id/reverse", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "payments.reverse");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الدفعة غير صالح" });
    }
    const parsed = reversePaymentInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "سبب عكس الدفعة غير صالح", issues: parsed.error.flatten() });

    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `payment:reverse:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);

    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(
        idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS",
        409,
        idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة"
      );
      const reversed = await reversePayment(tx, request.params.id, parsed.data, {
        actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key
      });
      const body = { data: reversed };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });
    return reply.status(result.status).send(result.body);
  });


  app.get("/api/v1/delivery-orders", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "delivery.read");
    const query = request.query as { driverUserId?: string; status?: string };
    const privileged = request.principal.permissions.has("delivery.manage");
    const filters: { driverUserId?: string; status?: string } = {};
    if (query.driverUserId !== undefined) filters.driverUserId = query.driverUserId;
    if (query.status !== undefined) filters.status = query.status;
    return reply.send({ data: await listDeliveryOrders(dependencies.db, request.principal.userId, privileged, filters) });
  });

  app.get<{ Params: { id: string } }>("/api/v1/delivery-orders/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "delivery.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف طلب التوصيل غير صالح" });
    const privileged = request.principal.permissions.has("delivery.manage");
    return reply.send({ data: await getDeliveryOrder(dependencies.db, request.params.id, request.principal.userId, privileged) });
  });

  app.get("/api/v1/campaigns", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "campaigns.read");
    const query = request.query as { partnerUserId?: string };
    const privileged = request.principal.permissions.has("campaigns.manage") && !request.principal.roles.has("advertiser");
    return reply.send({ data: await listCampaigns(dependencies.db, request.principal.userId, privileged, query.partnerUserId) });
  });

  app.get<{ Params: { id: string } }>("/api/v1/campaigns/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "campaigns.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الحملة غير صالح" });
    const privileged = request.principal.permissions.has("campaigns.manage") && !request.principal.roles.has("advertiser");
    return reply.send({ data: await getCampaign(dependencies.db, request.params.id, request.principal.userId, privileged) });
  });

  app.post("/api/v1/campaigns", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "campaigns.manage");
    const parsed = createCampaignInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات الحملة غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    const key=idempotencyKey.trim(), scope=`campaign:create:${request.principal.userId}`, requestHash=hashRequestBody(parsed.data);
    const result=await withTransaction(dependencies.pool,async tx=>{
      const idem=await beginIdempotency(tx,scope,key,requestHash); if(idem.kind==="replay") return idem;
      if(idem.kind==="conflict") throw new ApplicationError(idem.reason==="KEY_REUSED"?"IDEMPOTENCY_KEY_REUSED":"IDEMPOTENCY_IN_PROGRESS",409,idem.reason==="KEY_REUSED"?"تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة":"الطلب نفسه قيد المعالجة");
      const created=await createCampaign(tx,parsed.data,{actorId:request.principal!.userId,requestId:request.id,idempotencyKey:key});
      const body={data:created}; await completeIdempotency(tx,idem.id,201,body); return {kind:"new" as const,status:201,body};
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/campaigns/:id/status", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "campaigns.manage");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الحملة غير صالح" });
    const parsed=campaignStatusInputSchema.safeParse(request.body); if(!parsed.success) return reply.status(400).send({error:"VALIDATION_ERROR",message:"حالة الحملة غير صالحة",issues:parsed.error.flatten()});
    const idempotencyKey=request.headers["idempotency-key"]; if(typeof idempotencyKey!=="string"||idempotencyKey.trim().length<16||idempotencyKey.length>255) return reply.status(400).send({error:"IDEMPOTENCY_KEY_REQUIRED",message:"يجب إرسال مفتاح Idempotency-Key صالح"});
    const key=idempotencyKey.trim(),scope=`campaign:status:${request.params.id}:${request.principal.userId}`,requestHash=hashRequestBody(parsed.data),privileged=!request.principal.roles.has("advertiser");
    const result=await withTransaction(dependencies.pool,async tx=>{
      const idem=await beginIdempotency(tx,scope,key,requestHash);if(idem.kind==="replay")return idem;
      if(idem.kind==="conflict")throw new ApplicationError(idem.reason==="KEY_REUSED"?"IDEMPOTENCY_KEY_REUSED":"IDEMPOTENCY_IN_PROGRESS",409,idem.reason==="KEY_REUSED"?"تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة":"الطلب نفسه قيد المعالجة");
      const updated=await transitionCampaign(tx,request.params.id,parsed.data,{actorId:request.principal!.userId,requestId:request.id,idempotencyKey:key},privileged);
      const body={data:updated};await completeIdempotency(tx,idem.id,200,body);return {kind:"new" as const,status:200,body};
    }); return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/campaigns/:id/invoices", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "campaigns.manage");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الحملة غير صالح" });
    const parsed=linkCampaignInvoiceInputSchema.safeParse(request.body);if(!parsed.success)return reply.status(400).send({error:"VALIDATION_ERROR",message:"بيانات ربط الفاتورة غير صالحة",issues:parsed.error.flatten()});
    const idempotencyKey=request.headers["idempotency-key"];if(typeof idempotencyKey!=="string"||idempotencyKey.trim().length<16||idempotencyKey.length>255)return reply.status(400).send({error:"IDEMPOTENCY_KEY_REQUIRED",message:"يجب إرسال مفتاح Idempotency-Key صالح"});
    const key=idempotencyKey.trim(),scope=`campaign:invoice:${request.params.id}:${request.principal.userId}`,requestHash=hashRequestBody(parsed.data),privileged=!request.principal.roles.has("advertiser");
    const result=await withTransaction(dependencies.pool,async tx=>{
      const idem=await beginIdempotency(tx,scope,key,requestHash);if(idem.kind==="replay")return idem;
      if(idem.kind==="conflict")throw new ApplicationError(idem.reason==="KEY_REUSED"?"IDEMPOTENCY_KEY_REUSED":"IDEMPOTENCY_IN_PROGRESS",409,idem.reason==="KEY_REUSED"?"تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة":"الطلب نفسه قيد المعالجة");
      const linked=await linkCampaignInvoice(tx,request.params.id,parsed.data,{actorId:request.principal!.userId,requestId:request.id,idempotencyKey:key},privileged);
      const body={data:linked};await completeIdempotency(tx,idem.id,200,body);return {kind:"new" as const,status:200,body};
    });return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/campaigns/:id/spend", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "campaigns.spend");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف الحملة غير صالح" });
    const parsed=recordCampaignSpendInputSchema.safeParse(request.body);if(!parsed.success)return reply.status(400).send({error:"VALIDATION_ERROR",message:"بيانات الإنفاق غير صالحة",issues:parsed.error.flatten()});
    const idempotencyKey=request.headers["idempotency-key"];if(typeof idempotencyKey!=="string"||idempotencyKey.trim().length<16||idempotencyKey.length>255)return reply.status(400).send({error:"IDEMPOTENCY_KEY_REQUIRED",message:"يجب إرسال مفتاح Idempotency-Key صالح"});
    const key=idempotencyKey.trim(),scope=`campaign:spend:${request.params.id}:${request.principal.userId}`,requestHash=hashRequestBody(parsed.data),privileged=!request.principal.roles.has("advertiser");
    const result=await withTransaction(dependencies.pool,async tx=>{
      const idem=await beginIdempotency(tx,scope,key,requestHash);if(idem.kind==="replay")return idem;
      if(idem.kind==="conflict")throw new ApplicationError(idem.reason==="KEY_REUSED"?"IDEMPOTENCY_KEY_REUSED":"IDEMPOTENCY_IN_PROGRESS",409,idem.reason==="KEY_REUSED"?"تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة":"الطلب نفسه قيد المعالجة");
      const recorded=await recordCampaignSpend(tx,request.params.id,parsed.data,{actorId:request.principal!.userId,requestId:request.id,idempotencyKey:key},privileged);
      const body={data:recorded};await completeIdempotency(tx,idem.id,200,body);return {kind:"new" as const,status:200,body};
    });return reply.status(result.status).send(result.body);
  });

  app.post("/api/v1/delivery-orders", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "delivery.manage");
    const parsed = createDeliveryOrderInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات طلب التوصيل غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    const key = idempotencyKey.trim();
    const scope = `delivery:create:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);
    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS", 409, idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة");
      const created = await createDeliveryOrder(tx, parsed.data, { actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key });
      const body = { data: created };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/delivery-orders/:id/assign", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "delivery.assign");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف طلب التوصيل غير صالح" });
    const parsed = assignDeliveryOrderInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات إسناد السائق غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    const key = idempotencyKey.trim();
    const scope = `delivery:assign:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);
    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS", 409, idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة");
      const updated = await assignDeliveryOrder(tx, request.params.id, parsed.data, { actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key });
      const body = { data: updated };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/delivery-orders/:id/status", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "delivery.status");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف طلب التوصيل غير صالح" });
    const parsed = transitionDeliveryOrderInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "حالة طلب التوصيل غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    const key = idempotencyKey.trim();
    const scope = `delivery:status:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);
    const privileged = request.principal.permissions.has("delivery.manage");
    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS", 409, idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة");
      const updated = await transitionDeliveryOrder(tx, request.params.id, parsed.data, { actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key }, privileged);
      const body = { data: updated };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });
    return reply.status(result.status).send(result.body);
  });


  app.post("/api/v1/driver-collections", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "collections.manage");
    const parsed = openCollectionInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات جلسة التحصيل غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `driver-collection:open:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);
    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS", 409, idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة");
      const created = await openCollection(tx, parsed.data, { actorId: request.principal!.userId });
      const body = { data: created };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.get<{ Params: { id: string } }>("/api/v1/driver-collections/:id", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "collections.read");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف جلسة التحصيل غير صالح" });
    return reply.send({ data: await getCollection(dependencies.db, request.params.id, request.principal.userId, !request.principal.roles.has("driver")) });
  });

  app.post<{ Params: { id: string } }>("/api/v1/driver-collections/:id/payments", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "collections.manage");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف جلسة التحصيل غير صالح" });
    const parsed = addCollectionPaymentInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات الدفعة غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `driver-collection:payment:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);
    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS", 409, idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة");
      const created = await addCollectionPayment(tx, request.params.id, parsed.data, { actorId: request.principal!.userId, requestId: request.id, idempotencyKey: key });
      const body = { data: created };
      await completeIdempotency(tx, idem.id, 201, body);
      return { kind: "new" as const, status: 201, body };
    });
    return reply.status(result.status).send(result.body);
  });

  app.post<{ Params: { id: string } }>("/api/v1/driver-collections/:id/close", async (request, reply) => {
    if (!request.principal) return reply.status(401).send({ error: "UNAUTHORIZED", message: "المصادقة مطلوبة" });
    assertPermission(request.principal, "collections.manage");
    if (!/^[0-9a-fA-F-]{36}$/.test(request.params.id)) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "معرّف جلسة التحصيل غير صالح" });
    const parsed = closeCollectionInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "بيانات إغلاق جلسة التحصيل غير صالحة", issues: parsed.error.flatten() });
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 16 || idempotencyKey.length > 255) {
      return reply.status(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "يجب إرسال مفتاح Idempotency-Key صالح" });
    }
    const key = idempotencyKey.trim();
    const scope = `driver-collection:close:${request.params.id}:${request.principal.userId}`;
    const requestHash = hashRequestBody(parsed.data);
    const result = await withTransaction(dependencies.pool, async (tx) => {
      const idem = await beginIdempotency(tx, scope, key, requestHash);
      if (idem.kind === "replay") return idem;
      if (idem.kind === "conflict") throw new ApplicationError(idem.reason === "KEY_REUSED" ? "IDEMPOTENCY_KEY_REUSED" : "IDEMPOTENCY_IN_PROGRESS", 409, idem.reason === "KEY_REUSED" ? "تم استخدام مفتاح Idempotency-Key مع بيانات مختلفة" : "الطلب نفسه قيد المعالجة");
      const closed = await closeCollection(tx, request.params.id, parsed.data, { actorId: request.principal!.userId });
      const body = { data: closed };
      await completeIdempotency(tx, idem.id, 200, body);
      return { kind: "new" as const, status: 200, body };
    });
    return reply.status(result.status).send(result.body);
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

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "ليس لديك الصلاحية لتنفيذ هذا الإجراء"
      });
    }

    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;

    if (typeof statusCode === "number" && statusCode < 500) {
      return reply.status(statusCode).send({
        error: "REQUEST_ERROR",
        message: error instanceof Error ? error.message : "طلب غير صالح"
      });
    }

    return reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "حدث خطأ داخلي في الخادم"
    });
  });

  return app;
}
