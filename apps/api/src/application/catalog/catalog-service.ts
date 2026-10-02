import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { catalogCategories, catalogItems } from "../../db/catalog-schema.js";
import { recordAuditEvent } from "../audit.js";
import { ApplicationError } from "../../domain/errors.js";
import {
  catalogCodeSchema,
  catalogItemKindSchema,
  catalogItemUnitSchema,
  type CatalogCategory,
  type CatalogItem
} from "../../domain/catalog.js";

const decimalPattern = /^\d+(\.\d{1,10})?$/;

export const createCatalogItemInputSchema = z.object({
  categoryId: z.string().uuid(),
  code: catalogCodeSchema,
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  itemKind: catalogItemKindSchema,
  unit: catalogItemUnitSchema,
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  costPrice: z.string().trim().regex(decimalPattern),
  salePrice: z.string().trim().regex(decimalPattern),
  isDeliverable: z.boolean().default(false)
});

export type CreateCatalogItemInput = z.infer<typeof createCatalogItemInputSchema>;

function toCategory(row: typeof catalogCategories.$inferSelect): CatalogCategory {
  return row;
}

function toItem(row: typeof catalogItems.$inferSelect): CatalogItem {
  return {
    ...row,
    itemKind: row.itemKind as CatalogItem["itemKind"]
  };
}

function assertSaleNotBelowCost(costPrice: string, salePrice: string): void {
  const cost = Number(costPrice);
  const sale = Number(salePrice);
  if (!Number.isFinite(cost) || !Number.isFinite(sale) || sale < cost) {
    throw new ApplicationError(
      "INVALID_CATALOG_PRICES",
      400,
      "سعر البيع لا يمكن أن يكون أقل من سعر التكلفة"
    );
  }
}

export async function listCatalogCategories(db: Database): Promise<CatalogCategory[]> {
  const rows = await db.select().from(catalogCategories)
    .where(eq(catalogCategories.isActive, true));
  return rows.map(toCategory);
}

export async function createCatalogItem(
  db: Database,
  input: CreateCatalogItemInput,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<CatalogItem> {
  assertSaleNotBelowCost(input.costPrice, input.salePrice);

  const [category] = await db.select().from(catalogCategories)
    .where(and(
      eq(catalogCategories.id, input.categoryId),
      eq(catalogCategories.isActive, true)
    ))
    .limit(1);

  if (!category) {
    throw new ApplicationError(
      "CATALOG_CATEGORY_NOT_FOUND",
      404,
      "تصنيف الكتالوج غير موجود أو غير فعال"
    );
  }

  const [existing] = await db.select({ id: catalogItems.id })
    .from(catalogItems)
    .where(eq(catalogItems.code, input.code))
    .limit(1);

  if (existing) {
    throw new ApplicationError(
      "CATALOG_CODE_EXISTS",
      409,
      "رمز عنصر الكتالوج مستخدم مسبقاً"
    );
  }

  const [row] = await db.insert(catalogItems).values({
    id: randomUUID(),
    categoryId: input.categoryId,
    code: input.code,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    itemKind: input.itemKind,
    unit: input.unit,
    currencyCode: input.currencyCode,
    costPrice: input.costPrice,
    salePrice: input.salePrice,
    isDeliverable: input.isDeliverable,
    isActive: true
  }).returning();

  if (!row) {
    throw new ApplicationError(
      "CATALOG_ITEM_CREATE_FAILED",
      500,
      "تعذر إنشاء عنصر الكتالوج"
    );
  }

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "catalog_item.created",
    resourceType: "catalog_item",
    resourceId: row.id,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: {
      code: row.code,
      itemKind: row.itemKind,
      currencyCode: row.currencyCode
    }
  });

  return toItem(row);
}

export async function listCatalogItems(db: Database): Promise<CatalogItem[]> {
  const rows = await db.select().from(catalogItems)
    .where(eq(catalogItems.isActive, true));
  return rows.map(toItem);
}
