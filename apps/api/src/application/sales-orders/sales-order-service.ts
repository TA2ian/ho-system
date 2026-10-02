import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { catalogItems } from "../../db/catalog-schema.js";
import { customers } from "../../db/customer-schema.js";
import { salesOrderLines, salesOrders } from "../../db/sales-schema.js";
import { recordAuditEvent } from "../audit.js";
import { ApplicationError } from "../../domain/errors.js";
import { Decimal } from "decimal.js";
import type { SalesOrder, SalesOrderLine } from "../../domain/sales-order.js";

const decimalPattern = /^\d+(\.\d{1,10})?$/;

export const createSalesOrderInputSchema = z.object({
  customerId: z.string().uuid(),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(z.object({
    catalogItemId: z.string().uuid(),
    quantity: z.string().trim().regex(decimalPattern)
  })).min(1).max(500)
});

function toOrder(row: typeof salesOrders.$inferSelect): SalesOrder {
  return { ...row, status: row.status as SalesOrder["status"] };
}

function toLine(row: typeof salesOrderLines.$inferSelect): SalesOrderLine {
  return row;
}

function orderNumber(): string {
  return `SO-${new Date().toISOString().slice(0,10).replaceAll("-", "")}-${randomUUID().slice(0,8).toUpperCase()}`;
}

export async function createSalesOrder(
  db: Database,
  input: z.infer<typeof createSalesOrderInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<{ order: SalesOrder; lines: SalesOrderLine[] }> {
  const [customer] = await db.select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.status, "active")))
    .limit(1);
  if (!customer) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود أو غير فعال");

  const ids = [...new Set(input.lines.map((line) => line.catalogItemId))];
  const items = await db.select().from(catalogItems)
    .where(and(eq(catalogItems.isActive, true), inArray(catalogItems.id, ids)));

  if (items.length !== ids.length) {
    throw new ApplicationError("CATALOG_ITEM_NOT_FOUND", 404, "أحد عناصر الكتالوج غير موجود أو غير فعال");
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const selected = input.lines.map((line) => {
    const item = itemById.get(line.catalogItemId)!;
    if (item.currencyCode !== input.currencyCode) {
      throw new ApplicationError("ORDER_CURRENCY_MISMATCH", 400, "عملة الطلب لا تطابق عملة أحد عناصر الكتالوج");
    }
    const quantity = new Decimal(line.quantity);
    if (quantity.lte(0)) {
      throw new ApplicationError("INVALID_QUANTITY", 400, "الكمية يجب أن تكون أكبر من صفر");
    }
    return { line, item, quantity };
  });

  const id = randomUUID();
  const [order] = await db.insert(salesOrders).values({
    id,
    customerId: input.customerId,
    orderNumber: orderNumber(),
    status: "draft",
    currencyCode: input.currencyCode,
    notes: input.notes?.trim() || null,
    createdBy: context.actorId
  }).returning();

  if (!order) throw new ApplicationError("SALES_ORDER_CREATE_FAILED", 500, "تعذر إنشاء طلب البيع");

  const lines: SalesOrderLine[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    const selectedLine = selected[index]!;
    const [row] = await db.insert(salesOrderLines).values({
      id: randomUUID(),
      salesOrderId: id,
      lineNumber: index + 1,
      catalogItemId: selectedLine.item.id,
      description: selectedLine.item.name,
      quantity: selectedLine.quantity.toFixed(),
      unit: selectedLine.item.unit,
      unitCost: selectedLine.item.costPrice,
      unitPrice: selectedLine.item.salePrice,
      currencyCode: selectedLine.item.currencyCode
    }).returning();

    if (!row) throw new ApplicationError("SALES_ORDER_LINE_CREATE_FAILED", 500, "تعذر إنشاء سطر طلب البيع");
    lines.push(toLine(row));
  }

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "sales_order.created",
    resourceType: "sales_order",
    resourceId: id,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { orderNumber: order.orderNumber, lineCount: lines.length }
  });

  return { order: toOrder(order), lines };
}


export async function getSalesOrder(
  db: Database,
  orderId: string
): Promise<{ order: SalesOrder; lines: SalesOrderLine[] }> {
  const [order] = await db.select().from(salesOrders)
    .where(eq(salesOrders.id, orderId))
    .limit(1);
  if (!order) throw new ApplicationError("SALES_ORDER_NOT_FOUND", 404, "طلب البيع غير موجود");

  const lines = await db.select().from(salesOrderLines)
    .where(eq(salesOrderLines.salesOrderId, orderId))
    .orderBy(salesOrderLines.lineNumber);

  return { order: toOrder(order), lines: lines.map(toLine) };
}

export async function transitionSalesOrder(
  db: Database,
  orderId: string,
  target: "confirmed" | "cancelled",
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<{ order: SalesOrder; lines: SalesOrderLine[] }> {
  const rows = await db.execute(
    `SELECT id, status FROM sales_orders WHERE id = '${orderId}'::uuid FOR UPDATE`
  );
  const locked = rows.rows[0] as { id?: string; status?: string } | undefined;
  if (!locked) throw new ApplicationError("SALES_ORDER_NOT_FOUND", 404, "طلب البيع غير موجود");

  if (locked.status !== "draft") {
    throw new ApplicationError(
      "SALES_ORDER_INVALID_STATE",
      409,
      "لا يمكن تغيير حالة طلب البيع بعد مغادرة حالة المسودة"
    );
  }

  const now = new Date();
  const [updated] = await db.update(salesOrders)
    .set({
      status: target,
      confirmedAt: target === "confirmed" ? now : null,
      cancelledAt: target === "cancelled" ? now : null,
      updatedAt: now
    })
    .where(eq(salesOrders.id, orderId))
    .returning();

  if (!updated) throw new ApplicationError("SALES_ORDER_UPDATE_FAILED", 500, "تعذر تحديث طلب البيع");

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: `sales_order.${target}`,
    resourceType: "sales_order",
    resourceId: orderId,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { previousStatus: "draft", newStatus: target, orderNumber: updated.orderNumber }
  });

  const lines = await db.select().from(salesOrderLines)
    .where(eq(salesOrderLines.salesOrderId, orderId))
    .orderBy(salesOrderLines.lineNumber);

  return { order: toOrder(updated), lines: lines.map(toLine) };
}
