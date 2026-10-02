import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { customers } from "../../db/customer-schema.js";
import { invoiceLines, invoices } from "../../db/invoice-schema.js";
import { salesOrderLines, salesOrders } from "../../db/sales-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import type { Invoice, InvoiceLine, InvoiceStatus } from "../../domain/invoice.js";
import { recordAuditEvent } from "../audit.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const createInvoiceInputSchema = z.object({
  salesOrderId: z.string().uuid(),
  dueDate: dateSchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

function toInvoice(row: typeof invoices.$inferSelect): Invoice {
  return { ...row, status: row.status as InvoiceStatus };
}
function toLine(row: typeof invoiceLines.$inferSelect): InvoiceLine { return row; }

export async function createInvoiceFromSalesOrder(db: Database, input: z.infer<typeof createInvoiceInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }): Promise<{ invoice: Invoice; lines: InvoiceLine[] }> {
  const rows = await db.execute(sql`SELECT id, customer_id, currency_code, status, notes FROM sales_orders WHERE id = ${input.salesOrderId}::uuid FOR UPDATE`);
  const order = rows.rows[0] as { id: string; customer_id: string; currency_code: string; status: string; notes: string | null } | undefined;
  if (!order) throw new ApplicationError("SALES_ORDER_NOT_FOUND", 404, "طلب البيع غير موجود");
  if (order.status !== "confirmed") throw new ApplicationError("SALES_ORDER_NOT_CONFIRMED", 409, "لا يمكن إصدار فاتورة من طلب بيع غير مؤكد");
  const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, order.customer_id), eq(customers.status, "active"))).limit(1);
  if (!customer) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود أو غير فعال");
  const existing = await db.select().from(invoices).where(eq(invoices.sourceSalesOrderId, input.salesOrderId)).limit(1);
  if (existing[0]) {
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, existing[0].id)).orderBy(invoiceLines.lineNumber);
    return { invoice: toInvoice(existing[0]), lines: lines.map(toLine) };
  }
  const orderLines = await db.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, input.salesOrderId)).orderBy(salesOrderLines.lineNumber);
  if (orderLines.length === 0) throw new ApplicationError("SALES_ORDER_EMPTY", 409, "لا يمكن إصدار فاتورة لطلب بيع بلا سطور");
  const total = orderLines.reduce((sum, line) => sum.add(new Decimal(line.quantity).mul(new Decimal(line.unitPrice))), new Decimal(0));
  const id = randomUUID();
  const invoiceNumber = "INV-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
  const [invoice] = await db.insert(invoices).values({ id, customerId: order.customer_id, sourceSalesOrderId: input.salesOrderId, invoiceNumber, status: "draft", currencyCode: order.currency_code, totalAmount: total.toFixed(), dueDate: input.dueDate ?? null, notes: input.notes?.trim() || order.notes || null, createdBy: context.actorId }).returning();
  if (!invoice) throw new ApplicationError("INVOICE_CREATE_FAILED", 500, "تعذر إنشاء الفاتورة");
  const lines: InvoiceLine[] = [];
  for (let index = 0; index < orderLines.length; index += 1) {
    const source = orderLines[index]!;
    const lineTotal = new Decimal(source.quantity).mul(new Decimal(source.unitPrice));
    const [line] = await db.insert(invoiceLines).values({ id: randomUUID(), invoiceId: id, lineNumber: index + 1, salesOrderLineId: source.id, description: source.description, quantity: source.quantity, unit: source.unit, unitPrice: source.unitPrice, lineTotal: lineTotal.toFixed(), currencyCode: source.currencyCode }).returning();
    if (!line) throw new ApplicationError("INVOICE_LINE_CREATE_FAILED", 500, "تعذر إنشاء سطر الفاتورة");
    lines.push(toLine(line));
  }
  await recordAuditEvent(db, { actorId: context.actorId, action: "invoice.created", resourceType: "invoice", resourceId: id, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { invoiceNumber, sourceSalesOrderId: input.salesOrderId, totalAmount: total.toFixed() } });
  return { invoice: toInvoice(invoice), lines };
}

export async function issueInvoice(db: Database, invoiceId: string, context: { actorId: string; requestId: string; idempotencyKey: string }): Promise<{ invoice: Invoice; lines: InvoiceLine[] }> {
  const rows = await db.execute(sql`SELECT id, status FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`);
  const locked = rows.rows[0] as { id?: string; status?: string } | undefined;
  if (!locked) throw new ApplicationError("INVOICE_NOT_FOUND", 404, "الفاتورة غير موجودة");
  if (locked.status !== "draft") throw new ApplicationError("INVOICE_INVALID_STATE", 409, "لا يمكن إصدار فاتورة بعد مغادرة حالة المسودة");
  const now = new Date();
  const [updated] = await db.update(invoices).set({ status: "issued", issueDate: now.toISOString().slice(0, 10), issuedAt: now, updatedAt: now }).where(eq(invoices.id, invoiceId)).returning();
  if (!updated) throw new ApplicationError("INVOICE_UPDATE_FAILED", 500, "تعذر إصدار الفاتورة");
  await recordAuditEvent(db, { actorId: context.actorId, action: "invoice.issued", resourceType: "invoice", resourceId: invoiceId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { invoiceNumber: updated.invoiceNumber } });
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.lineNumber);
  return { invoice: toInvoice(updated), lines: lines.map(toLine) };
}

export async function getInvoice(db: Database, invoiceId: string): Promise<{ invoice: Invoice; lines: InvoiceLine[] }> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw new ApplicationError("INVOICE_NOT_FOUND", 404, "الفاتورة غير موجودة");
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.lineNumber);
  return { invoice: toInvoice(invoice), lines: lines.map(toLine) };
}
