import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { customers } from "../../db/customer-schema.js";
import { invoices } from "../../db/invoice-schema.js";
import { paymentAllocations, payments } from "../../db/payment-schema.js";
import { paymentAllocationReversals } from "../../db/payment-reversal-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import type { Payment, PaymentAllocation, PaymentMethod, PaymentStatus } from "../../domain/payment.js";
import { recordAuditEvent } from "../audit.js";

const dateTimeSchema = z.string().datetime({ offset: true });

export const createPaymentInputSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,10})?$/).refine((value) => new Decimal(value).gt(0), "المبلغ يجب أن يكون أكبر من صفر"),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  method: z.enum(["cash", "sham_cash"]),
  reference: z.string().trim().max(255).nullable().optional(),
  receivedAt: dateTimeSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export const allocatePaymentInputSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,10})?$/).refine((value) => new Decimal(value).gt(0), "مبلغ التخصيص يجب أن يكون أكبر من صفر")
});

function toPayment(row: typeof payments.$inferSelect): Payment {
  return { ...row, status: row.status as PaymentStatus, method: row.method as PaymentMethod };
}

function toAllocation(row: typeof paymentAllocations.$inferSelect): PaymentAllocation {
  return row;
}

async function paymentWithAllocations(db: Database, paymentId: string): Promise<{ payment: Payment; allocations: PaymentAllocation[] }> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new ApplicationError("PAYMENT_NOT_FOUND", 404, "الدفعة غير موجودة");
  const allocations = await db.select().from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .orderBy(paymentAllocations.createdAt);
  return { payment: toPayment(payment), allocations: allocations.map(toAllocation) };
}

export async function createPayment(
  db: Database,
  input: z.infer<typeof createPaymentInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<{ payment: Payment; allocations: PaymentAllocation[] }> {
  const [customer] = await db.select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.status, "active")))
    .limit(1);
  if (!customer) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود أو غير فعال");

  const id = randomUUID();
  const paymentNumber = "PAY-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  const [payment] = await db.insert(payments).values({
    id,
    customerId: input.customerId,
    paymentNumber,
    status: "recorded",
    amount: input.amount,
    currencyCode: input.currencyCode,
    method: input.method,
    reference: input.reference?.trim() || null,
    receivedAt,
    receivedBy: context.actorId,
    notes: input.notes?.trim() || null
  }).returning();

  if (!payment) throw new ApplicationError("PAYMENT_CREATE_FAILED", 500, "تعذر تسجيل الدفعة");

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "payment.recorded",
    resourceType: "payment",
    resourceId: id,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { paymentNumber, amount: input.amount, currencyCode: input.currencyCode, method: input.method }
  });

  return { payment: toPayment(payment), allocations: [] };
}

export async function getPayment(db: Database, paymentId: string): Promise<{ payment: Payment; allocations: PaymentAllocation[] }> {
  return paymentWithAllocations(db, paymentId);
}

export async function allocatePayment(
  db: Database,
  paymentId: string,
  input: z.infer<typeof allocatePaymentInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<{ payment: Payment; allocations: PaymentAllocation[]; invoiceOutstanding: string }> {
  const paymentRows = await db.execute(sql`SELECT id, customer_id, amount, currency_code, status FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`);
  const payment = paymentRows.rows[0] as { id: string; customer_id: string; amount: string; currency_code: string; status: string } | undefined;
  if (!payment) throw new ApplicationError("PAYMENT_NOT_FOUND", 404, "الدفعة غير موجودة");
  if (payment.status !== "recorded") throw new ApplicationError("PAYMENT_NOT_ACTIVE", 409, "لا يمكن تخصيص دفعة غير مسجلة");

  const invoiceRows = await db.execute(sql`SELECT id, customer_id, status, currency_code, total_amount FROM invoices WHERE id = ${input.invoiceId}::uuid FOR UPDATE`);
  const invoice = invoiceRows.rows[0] as { id: string; customer_id: string; status: string; currency_code: string; total_amount: string } | undefined;
  if (!invoice) throw new ApplicationError("INVOICE_NOT_FOUND", 404, "الفاتورة غير موجودة");
  if (invoice.status !== "issued") throw new ApplicationError("INVOICE_NOT_ISSUED", 409, "لا يمكن تخصيص دفعة إلى فاتورة غير صادرة");
  if (invoice.customer_id !== payment.customer_id) throw new ApplicationError("CUSTOMER_MISMATCH", 409, "الدفعة والفاتورة تخصان عميلين مختلفين");
  if (invoice.currency_code !== payment.currency_code) throw new ApplicationError("CURRENCY_MISMATCH", 409, "يجب أن تتطابق عملة الدفعة مع عملة الفاتورة");

  const existing = await db.select().from(paymentAllocations).where(and(
    eq(paymentAllocations.paymentId, paymentId),
    eq(paymentAllocations.invoiceId, input.invoiceId)
  )).limit(1);
  if (existing[0]) throw new ApplicationError("PAYMENT_ALREADY_ALLOCATED", 409, "تم تخصيص هذه الدفعة لهذه الفاتورة مسبقاً");

  const allocatedPaymentRows = await db.execute(sql`SELECT COALESCE(SUM(amount), 0)::text AS total FROM payment_allocations WHERE payment_id = ${paymentId}::uuid`);
  const allocatedPayment = new Decimal(String((allocatedPaymentRows.rows[0] as { total?: string }).total ?? "0"));
  const paymentRemaining = new Decimal(payment.amount).sub(allocatedPayment);
  const requested = new Decimal(input.amount);
  if (requested.gt(paymentRemaining)) throw new ApplicationError("PAYMENT_OVER_ALLOCATION", 409, "مبلغ التخصيص يتجاوز الرصيد المتبقي من الدفعة");

  const allocatedInvoiceRows = await db.execute(sql`SELECT COALESCE(SUM(amount), 0)::text AS total FROM payment_allocations WHERE invoice_id = ${input.invoiceId}::uuid`);
  const allocatedInvoice = new Decimal(String((allocatedInvoiceRows.rows[0] as { total?: string }).total ?? "0"));
  const invoiceOutstanding = new Decimal(invoice.total_amount).sub(allocatedInvoice);
  if (requested.gt(invoiceOutstanding)) throw new ApplicationError("INVOICE_OVER_ALLOCATION", 409, "مبلغ التخصيص يتجاوز الرصيد المستحق على الفاتورة");

  await db.insert(paymentAllocations).values({
    id: randomUUID(),
    paymentId,
    invoiceId: input.invoiceId,
    amount: requested.toFixed(),
    currencyCode: payment.currency_code
  });

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "payment.allocated",
    resourceType: "payment",
    resourceId: paymentId,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { invoiceId: input.invoiceId, amount: requested.toFixed(), currencyCode: payment.currency_code }
  });

  const result = await paymentWithAllocations(db, paymentId);
  return {
    ...result,
    invoiceOutstanding: invoiceOutstanding.sub(requested).toFixed()
  };
}

export const reversePaymentInputSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export async function reversePayment(
  db: Database,
  paymentId: string,
  input: z.infer<typeof reversePaymentInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<{ payment: Payment; allocations: PaymentAllocation[] }> {
  const rows = await db.execute(sql`SELECT id, status FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`);
  const payment = rows.rows[0] as { id?: string; status?: string } | undefined;
  if (!payment) throw new ApplicationError("PAYMENT_NOT_FOUND", 404, "الدفعة غير موجودة");
  if (payment.status !== "recorded") throw new ApplicationError("PAYMENT_ALREADY_VOIDED", 409, "الدفعة ليست في حالة مسجلة");

  const allocations = await db.select().from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .orderBy(paymentAllocations.createdAt);

  for (const allocation of allocations) {
    const reversedRows = await db.execute(sql`SELECT COALESCE(SUM(amount), 0)::text AS total FROM payment_allocation_reversals WHERE payment_allocation_id = ${allocation.id}::uuid`);
    const reversed = new Decimal(String((reversedRows.rows[0] as { total?: string }).total ?? "0"));
    const remaining = new Decimal(allocation.amount).sub(reversed);
    if (remaining.gt(0)) {
      await db.insert(paymentAllocationReversals).values({
        id: randomUUID(),
        paymentAllocationId: allocation.id,
        amount: remaining.toFixed(),
        currencyCode: allocation.currencyCode,
        reason: input.reason,
        reversedAt: new Date(),
        reversedBy: context.actorId
      });
    }
  }

  const now = new Date();
  const [updated] = await db.update(payments)
    .set({ status: "voided", voidedAt: now, updatedAt: now })
    .where(eq(payments.id, paymentId))
    .returning();
  if (!updated) throw new ApplicationError("PAYMENT_UPDATE_FAILED", 500, "تعذر عكس الدفعة");

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "payment.reversed",
    resourceType: "payment",
    resourceId: paymentId,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { reason: input.reason }
  });

  return paymentWithAllocations(db, paymentId);
}
