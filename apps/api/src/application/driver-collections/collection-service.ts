import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import {
  driverCollectionPayments,
  driverCollectionSessions,
  driverCollectionSettlementCounts,
  payments
} from "../../db/payment-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";
import { recordDeliveryCollection, deliveryCollectionInputSchema } from "../delivery/delivery-service.js";

const decimalInput = z.string()
  .regex(/^\d+(\.\d{1,10})?$/)
  .refine((value) => new Decimal(value).gte(0), "المبلغ يجب ألا يكون سالباً");

const methodSchema = z.enum(["cash", "sham_cash"]);

export const openCollectionInputSchema = z.object({
  driverUserId: z.string().uuid(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export const addCollectionPaymentInputSchema = deliveryCollectionInputSchema;

export const closeCollectionInputSchema = z.object({
  counts: z.array(z.object({
    currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    method: methodSchema,
    countedAmount: decimalInput
  })).max(10),
  notes: z.string().trim().max(2000).nullable().optional()
});

async function getSession(db: Database, sessionId: string) {
  const [session] = await db.select().from(driverCollectionSessions)
    .where(eq(driverCollectionSessions.id, sessionId)).limit(1);
  if (!session) throw new ApplicationError("COLLECTION_NOT_FOUND", 404, "جلسة التحصيل غير موجودة");
  return session;
}

async function assertActiveDriver(db: Database, driverUserId: string) {
  const result = await db.execute(sql`
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${driverUserId}::uuid
      AND u.status = 'active'
      AND r.code = 'driver'
    LIMIT 1
  `);
  if (!result.rows[0]) throw new ApplicationError("COLLECTION_DRIVER_NOT_ACTIVE", 403, "المستخدم ليس سائقاً فعالاً");
}

function assertDriverAccess(session: { driverUserId: string }, actorId: string): void {
  if (session.driverUserId !== actorId) {
    throw new ApplicationError("COLLECTION_DRIVER_MISMATCH", 403, "جلسة التحصيل تخص سائقاً آخر");
  }
}

export async function openCollection(
  db: Database,
  input: z.infer<typeof openCollectionInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
) {
  if (input.driverUserId !== context.actorId) {
    throw new ApplicationError("COLLECTION_DRIVER_MISMATCH", 403, "يمكن للسائق فتح جلسة التحصيل الخاصة به فقط");
  }
  await assertActiveDriver(db, context.actorId);

  const existing = await db.select().from(driverCollectionSessions)
    .where(and(
      eq(driverCollectionSessions.driverUserId, input.driverUserId),
      eq(driverCollectionSessions.status, "open")
    )).limit(1);
  if (existing[0]) throw new ApplicationError("COLLECTION_ALREADY_OPEN", 409, "لديك جلسة تحصيل مفتوحة بالفعل");

  let session: typeof driverCollectionSessions.$inferSelect | undefined;
  try {
    const [created] = await db.insert(driverCollectionSessions).values({
      id: randomUUID(),
      driverUserId: input.driverUserId,
      status: "open",
      openedBy: context.actorId,
      notes: input.notes?.trim() || null
    }).returning();
    session = created;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
      throw new ApplicationError("COLLECTION_ALREADY_OPEN", 409, "لديك جلسة تحصيل مفتوحة بالفعل");
    }
    throw error;
  }

  if (!session) throw new ApplicationError("COLLECTION_CREATE_FAILED", 500, "تعذر فتح جلسة التحصيل");

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "collection.open",
    resourceType: "driver_collection_session",
    resourceId: session.id,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey
  });

  return session;
}

export async function getCollection(db: Database, sessionId: string, actorId: string, allowOtherDrivers = false) {
  const session = await getSession(db, sessionId);
  if (!allowOtherDrivers) assertDriverAccess(session, actorId);

  const linked = await db.select({
    id: driverCollectionPayments.id,
    paymentId: driverCollectionPayments.paymentId,
    addedAt: driverCollectionPayments.addedAt,
    paymentNumber: payments.paymentNumber,
    status: payments.status,
    amount: payments.amount,
    currencyCode: payments.currencyCode,
    method: payments.method,
    receivedAt: payments.receivedAt
  })
    .from(driverCollectionPayments)
    .innerJoin(payments, eq(payments.id, driverCollectionPayments.paymentId))
    .where(eq(driverCollectionPayments.sessionId, sessionId))
    .orderBy(asc(driverCollectionPayments.addedAt));

  const settlement = await db.select().from(driverCollectionSettlementCounts)
    .where(eq(driverCollectionSettlementCounts.sessionId, sessionId))
    .orderBy(asc(driverCollectionSettlementCounts.createdAt));

  return { session, payments: linked, settlement };
}

export async function addCollectionPayment(
  db: Database,
  sessionId: string,
  input: z.infer<typeof addCollectionPaymentInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
) {
  const rows = await db.execute(sql<{ id: string; driver_user_id: string; status: string; opened_at: Date; opened_by: string; closed_at: Date | null; closed_by: string | null; notes: string | null; created_at: Date; updated_at: Date }>`SELECT id, driver_user_id, status, opened_at, opened_by, closed_at, closed_by, notes, created_at, updated_at FROM driver_collection_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`);
  const session = rows.rows[0];
  if (!session) throw new ApplicationError("COLLECTION_NOT_FOUND", 404, "جلسة التحصيل غير موجودة");
  if (session.driver_user_id !== context.actorId) throw new ApplicationError("COLLECTION_DRIVER_MISMATCH", 403, "جلسة التحصيل تخص سائقاً آخر");
  if (session.status !== "open") {
    throw new ApplicationError("COLLECTION_CLOSED", 409, "جلسة التحصيل مغلقة");
  }

  const created = await recordDeliveryCollection(db, input.deliveryOrderId, sessionId, input, context);

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "collection.payment_linked",
    resourceType: "driver_collection_session",
    resourceId: sessionId,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { deliveryOrderId: input.deliveryOrderId, paymentId: created.collectionPayment.paymentId }
  });

  return created;
}

export async function closeCollection(
  db: Database,
  sessionId: string,
  input: z.infer<typeof closeCollectionInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
) {
  const rows = await db.execute(sql<{ id: string; driver_user_id: string; status: string }>`SELECT id, driver_user_id, status FROM driver_collection_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`);
  const session = rows.rows[0];
  if (!session) throw new ApplicationError("COLLECTION_NOT_FOUND", 404, "جلسة التحصيل غير موجودة");
  if (session.driver_user_id !== context.actorId) {
    throw new ApplicationError("COLLECTION_DRIVER_MISMATCH", 403, "جلسة التحصيل تخص سائقاً آخر");
  }
  if (session.status !== "open") throw new ApplicationError("COLLECTION_CLOSED", 409, "جلسة التحصيل مغلقة");

  const duplicateKeys = new Set<string>();
  for (const count of input.counts) {
    const key = count.currencyCode + ":" + count.method;
    if (duplicateKeys.has(key)) {
      throw new ApplicationError("COLLECTION_DUPLICATE_COUNT", 400, "يوجد تكرار في عملة/طريقة التسوية");
    }
    duplicateKeys.add(key);
  }

  const expectedRows = await db.execute(sql<{ currency_code: string; method: string; expected_amount: string }>`SELECT currency_code, method, COALESCE(SUM(amount), 0)::text AS expected_amount FROM payments p JOIN driver_collection_payments dcp ON dcp.payment_id = p.id WHERE dcp.session_id = ${sessionId}::uuid AND p.status = 'recorded' GROUP BY currency_code, method ORDER BY currency_code, method`);

  const expected = new Map<string, string>();
  for (const row of expectedRows.rows as Array<{ currency_code: string; method: string; expected_amount: string }>) {
    expected.set(row.currency_code + ":" + row.method, row.expected_amount);
  }

  const keys = new Set([...expected.keys(), ...input.counts.map((c) => c.currencyCode + ":" + c.method)]);

  for (const key of keys) {
    const separator = key.indexOf(":");
    const currencyCode = key.slice(0, separator);
    const method = key.slice(separator + 1) as "cash" | "sham_cash";
    const expectedAmount = new Decimal(String(expected.get(key) ?? "0"));
    const count = input.counts.find((item) => item.currencyCode === currencyCode && item.method === method);
    const countedAmount = new Decimal(count?.countedAmount ?? "0");
    const difference = countedAmount.sub(expectedAmount);

    await db.insert(driverCollectionSettlementCounts).values({
      id: randomUUID(),
      sessionId,
      currencyCode,
      method,
      expectedAmount: expectedAmount.toFixed(),
      countedAmount: countedAmount.toFixed(),
      differenceAmount: difference.toFixed()
    });
  }

  const now = new Date();
  await db.update(driverCollectionSessions)
    .set({ status: "closed", closedAt: now, closedBy: context.actorId, notes: input.notes?.trim() || null, updatedAt: now })
    .where(eq(driverCollectionSessions.id, sessionId));

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "collection.close",
    resourceType: "driver_collection_session",
    resourceId: sessionId,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey
  });

  return getCollection(db, sessionId, context.actorId);
}
