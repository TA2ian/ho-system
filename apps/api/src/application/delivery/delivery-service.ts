import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { deliveryOrderPayments, deliveryOrders } from "../../db/delivery-schema.js";
import { driverCollectionPayments } from "../../db/payment-schema.js";
import { roles, userRoles, users } from "../../db/schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { deliveryStatusSchema, deliveryTypeSchema } from "../../domain/delivery.js";
import { recordAuditEvent } from "../audit.js";
import { pageRows, type Pagination } from "../pagination.js";
import { getInvoiceReceivable } from "../receivables/receivable-service.js";
import { allocatePayment, createPayment, createPaymentInputSchema } from "../payments/payment-service.js";

const uuidSchema = z.string().uuid();
const textField = (max: number) => z.string().trim().max(max).nullable().optional();

export const createDeliveryOrderInputSchema = z.object({
  deliveryType: deliveryTypeSchema,
  customerId: uuidSchema.nullable().optional(),
  salesOrderId: uuidSchema.nullable().optional(),
  invoiceId: uuidSchema.nullable().optional(),
  assignedDriverId: uuidSchema.nullable().optional(),
  address: textField(2000),
  contactName: textField(255),
  contactPhone: textField(100),
  notes: textField(2000)
}).superRefine((input, ctx) => {
  if (input.deliveryType === "external" && (!input.customerId || !input.invoiceId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: "التسليم الخارجي يتطلب عميلاً وفاتورة" });
  }
  if (input.deliveryType === "internal" && (input.customerId || input.invoiceId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryType"], message: "التسليم الداخلي لا يرتبط بعميل أو ذمة مالية" });
  }
});
export const assignDeliveryOrderInputSchema = z.object({ driverUserId: uuidSchema });
export const transitionDeliveryOrderInputSchema = z.object({ status: deliveryStatusSchema });
export const deliveryCollectionInputSchema = createPaymentInputSchema.omit({ customerId: true }).extend({ deliveryOrderId: uuidSchema });

const transitionMap: Record<string, string[]> = {
  pending: ["assigned", "cancelled"],
  assigned: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "failed", "returned"],
  failed: ["assigned"],
  delivered: [], returned: [], cancelled: []
};

async function assertActiveDriver(db: Database, driverUserId: string) {
  const rows = await db.select({ id: users.id }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.id, driverUserId), eq(users.status, "active"), eq(roles.code, "driver"))).limit(1);
  if (!rows[0]) throw new ApplicationError("DRIVER_NOT_FOUND", 404, "السائق غير موجود أو غير فعال");
}
async function getDeliveryRow(db: Database, deliveryOrderId: string) {
  const [row] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, deliveryOrderId)).limit(1);
  if (!row) throw new ApplicationError("DELIVERY_NOT_FOUND", 404, "طلب التوصيل غير موجود");
  return row;
}

export async function createDeliveryOrder(db: Database, input: z.infer<typeof createDeliveryOrderInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  if (input.deliveryType === "external") {
    const result = await db.execute(sql`SELECT id, customer_id, status, source_sales_order_id FROM invoices WHERE id = ${input.invoiceId!}::uuid`);
    const invoice = result.rows[0] as { id: string; customer_id: string; status: string; source_sales_order_id: string | null } | undefined;
    if (!invoice) throw new ApplicationError("INVOICE_NOT_FOUND", 404, "الفاتورة غير موجودة");
    if (invoice.status !== "issued") throw new ApplicationError("INVOICE_NOT_ISSUED", 409, "لا يمكن إنشاء تسليم مرتبط بفاتورة غير صادرة");
    if (invoice.customer_id !== input.customerId) throw new ApplicationError("CUSTOMER_MISMATCH", 409, "العميل لا يطابق عميل الفاتورة");
    if (input.salesOrderId) {
      const orderResult = await db.execute(sql`SELECT id, customer_id FROM sales_orders WHERE id = ${input.salesOrderId!}::uuid`);
      const order = orderResult.rows[0] as { id: string; customer_id: string } | undefined;
      if (!order) throw new ApplicationError("SALES_ORDER_NOT_FOUND", 404, "طلب البيع غير موجود");
      if (order.customer_id !== input.customerId) throw new ApplicationError("CUSTOMER_MISMATCH", 409, "العميل لا يطابق عميل طلب البيع");
      if (invoice.source_sales_order_id && invoice.source_sales_order_id !== input.salesOrderId) throw new ApplicationError("SALES_ORDER_MISMATCH", 409, "طلب البيع لا يطابق مصدر الفاتورة");
    }
  }
  if (input.assignedDriverId) await assertActiveDriver(db, input.assignedDriverId);
  const id = randomUUID();
  const deliveryNumber = "DEL-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
  const now = new Date();
  const [created] = await db.insert(deliveryOrders).values({
    id, deliveryNumber, deliveryType: input.deliveryType,
    customerId: input.customerId ?? null, salesOrderId: input.salesOrderId ?? null, invoiceId: input.invoiceId ?? null,
    assignedDriverId: input.assignedDriverId ?? null, status: input.assignedDriverId ? "assigned" : "pending",
    address: input.address?.trim() || null, contactName: input.contactName?.trim() || null, contactPhone: input.contactPhone?.trim() || null,
    notes: input.notes?.trim() || null, createdBy: context.actorId, assignedAt: input.assignedDriverId ? now : null
  }).returning();
  if (!created) throw new ApplicationError("DELIVERY_CREATE_FAILED", 500, "تعذر إنشاء طلب التوصيل");
  await recordAuditEvent(db, { actorId: context.actorId, action: "delivery.created", resourceType: "delivery_order", resourceId: id, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { deliveryNumber, deliveryType: input.deliveryType, customerId: input.customerId ?? null, invoiceId: input.invoiceId ?? null, assignedDriverId: input.assignedDriverId ?? null } });
  return getDeliveryOrder(db, id, context.actorId, true);
}

export async function getDeliveryOrder(db: Database, deliveryOrderId: string, actorId: string, privileged = false) {
  if (!uuidSchema.safeParse(deliveryOrderId).success) throw new ApplicationError("DELIVERY_ID_INVALID", 400, "معرّف طلب التوصيل غير صالح");
  const row = await getDeliveryRow(db, deliveryOrderId);
  if (!privileged && row.assignedDriverId !== actorId) throw new ApplicationError("DELIVERY_DRIVER_MISMATCH", 403, "طلب التوصيل غير مسند إليك");
  const receivable = row.deliveryType === "external" && row.invoiceId ? await getInvoiceReceivable(db, row.invoiceId) : null;
  return { deliveryOrder: row, receivable };
}

export async function listDeliveryOrders(db: Database, actorId: string, privileged: boolean, filters: { driverUserId?: string; status?: string }, pagination: Pagination) {
  const conditions = [];
  if (!privileged) conditions.push(eq(deliveryOrders.assignedDriverId, actorId));
  else if (filters.driverUserId) {
    if (!uuidSchema.safeParse(filters.driverUserId).success) throw new ApplicationError("DRIVER_ID_INVALID", 400, "معرّف السائق غير صالح");
    conditions.push(eq(deliveryOrders.assignedDriverId, filters.driverUserId));
  }
  if (filters.status) {
    const parsed = deliveryStatusSchema.safeParse(filters.status);
    if (!parsed.success) throw new ApplicationError("DELIVERY_STATUS_INVALID", 400, "حالة طلب التوصيل غير صالحة");
    conditions.push(eq(deliveryOrders.status, parsed.data));
  }
  const rows = await db.select().from(deliveryOrders).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(deliveryOrders.createdAt)).limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}

export async function assignDeliveryOrder(db: Database, deliveryOrderId: string, input: z.infer<typeof assignDeliveryOrderInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  await assertActiveDriver(db, input.driverUserId);
  const result = await db.execute(sql`SELECT id, status FROM delivery_orders WHERE id = ${deliveryOrderId}::uuid FOR UPDATE`);
  const row = result.rows[0] as { id: string; status: string } | undefined;
  if (!row) throw new ApplicationError("DELIVERY_NOT_FOUND", 404, "طلب التوصيل غير موجود");
  if (!["pending", "failed"].includes(row.status)) throw new ApplicationError("DELIVERY_INVALID_STATE", 409, "لا يمكن إسناد طلب التوصيل من حالته الحالية");
  const now = new Date();
  const [updated] = await db.update(deliveryOrders).set({ assignedDriverId: input.driverUserId, status: "assigned", assignedAt: now, updatedAt: now }).where(eq(deliveryOrders.id, deliveryOrderId)).returning();
  if (!updated) throw new ApplicationError("DELIVERY_UPDATE_FAILED", 500, "تعذر إسناد طلب التوصيل");
  await recordAuditEvent(db, { actorId: context.actorId, action: "delivery.assigned", resourceType: "delivery_order", resourceId: deliveryOrderId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { driverUserId: input.driverUserId } });
  return getDeliveryOrder(db, deliveryOrderId, context.actorId, true);
}

export async function transitionDeliveryOrder(db: Database, deliveryOrderId: string, input: z.infer<typeof transitionDeliveryOrderInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }, privileged = false) {
  const result = await db.execute(sql`SELECT id, status, assigned_driver_id FROM delivery_orders WHERE id = ${deliveryOrderId}::uuid FOR UPDATE`);
  const row = result.rows[0] as { id: string; status: string; assigned_driver_id: string | null } | undefined;
  if (!row) throw new ApplicationError("DELIVERY_NOT_FOUND", 404, "طلب التوصيل غير موجود");
  if (!privileged && row.assigned_driver_id !== context.actorId) throw new ApplicationError("DELIVERY_DRIVER_MISMATCH", 403, "طلب التوصيل غير مسند إليك");
  const allowed = transitionMap[row.status] ?? [];
  if (!allowed.includes(input.status)) throw new ApplicationError("DELIVERY_INVALID_TRANSITION", 409, "الانتقال المطلوب غير مسموح به");
  if (input.status === "out_for_delivery" && !row.assigned_driver_id) throw new ApplicationError("DELIVERY_DRIVER_REQUIRED", 409, "لا يمكن بدء التوصيل دون سائق");
  const now = new Date();
  const timestampUpdate: Record<string, Date> = {};
  if (input.status === "out_for_delivery") timestampUpdate.outForDeliveryAt = now;
  if (input.status === "delivered") timestampUpdate.deliveredAt = now;
  if (input.status === "failed") timestampUpdate.failedAt = now;
  if (input.status === "returned") timestampUpdate.returnedAt = now;
  if (input.status === "cancelled") timestampUpdate.cancelledAt = now;
  const [updated] = await db.update(deliveryOrders).set({ status: input.status, updatedAt: now, ...timestampUpdate }).where(eq(deliveryOrders.id, deliveryOrderId)).returning();
  if (!updated) throw new ApplicationError("DELIVERY_UPDATE_FAILED", 500, "تعذر تحديث حالة طلب التوصيل");
  await recordAuditEvent(db, { actorId: context.actorId, action: "delivery.status_changed", resourceType: "delivery_order", resourceId: deliveryOrderId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { from: row.status, to: input.status } });
  return getDeliveryOrder(db, deliveryOrderId, context.actorId, privileged);
}

export async function recordDeliveryCollection(db: Database, deliveryOrderId: string, sessionId: string, input: z.infer<typeof deliveryCollectionInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  const row = await getDeliveryRow(db, deliveryOrderId);
  if (row.deliveryType !== "external" || !row.invoiceId || !row.customerId) throw new ApplicationError("DELIVERY_NOT_COLLECTIBLE", 409, "هذا التسليم لا يحمل ذمة مالية قابلة للتحصيل");
  if (row.assignedDriverId !== context.actorId) throw new ApplicationError("DELIVERY_DRIVER_MISMATCH", 403, "طلب التوصيل غير مسند إليك");
  if (!["out_for_delivery", "delivered"].includes(row.status)) throw new ApplicationError("DELIVERY_NOT_READY_FOR_COLLECTION", 409, "لا يمكن التحصيل قبل بدء التوصيل");
  const sessionResult = await db.execute(sql`
    SELECT id, status, driver_user_id
    FROM driver_collection_sessions
    WHERE id = ${sessionId}::uuid
    FOR UPDATE
  `);
  const session = sessionResult.rows[0] as { id: string; status: string; driver_user_id: string } | undefined;
  if (!session) throw new ApplicationError("COLLECTION_SESSION_NOT_FOUND", 404, "جلسة التحصيل غير موجودة");
  if (session.driver_user_id !== context.actorId) throw new ApplicationError("COLLECTION_SESSION_DRIVER_MISMATCH", 403, "جلسة التحصيل ليست تابعة لك");
  if (session.status !== "open") throw new ApplicationError("COLLECTION_SESSION_NOT_OPEN", 409, "جلسة التحصيل مغلقة");

  const paymentInput = { ...input, customerId: row.customerId };
  const created = await createPayment(db, paymentInput, context);
  const allocated = await allocatePayment(db, created.payment.id, { invoiceId: row.invoiceId, amount: input.amount }, context);
  const [collectionPayment] = await db.insert(driverCollectionPayments).values({
    id: randomUUID(),
    sessionId,
    paymentId: created.payment.id,
    addedBy: context.actorId
  }).returning();
  if (!collectionPayment) throw new ApplicationError("COLLECTION_PAYMENT_LINK_FAILED", 500, "تعذر ربط الدفعة بجلسة التحصيل");
  const [linked] = await db.insert(deliveryOrderPayments).values({ id: randomUUID(), deliveryOrderId, paymentId: created.payment.id }).returning();
  if (!linked) throw new ApplicationError("DELIVERY_PAYMENT_LINK_FAILED", 500, "تعذر ربط الدفعة بطلب التوصيل");
  await recordAuditEvent(db, { actorId: context.actorId, action: "delivery.payment_collected", resourceType: "delivery_order", resourceId: deliveryOrderId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { paymentId: created.payment.id, invoiceId: row.invoiceId, amount: input.amount, currencyCode: input.currencyCode, sessionId } });
  return { ...allocated, deliveryOrderPayment: linked, collectionPayment };
}
