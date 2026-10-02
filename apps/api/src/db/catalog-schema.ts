import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { currencies } from "./schema.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const catalogCategories = pgTable("catalog_categories", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
}, (table) => [
  index("catalog_categories_active_idx").on(table.isActive)
]);

export const catalogItems = pgTable("catalog_items", {
  id: uuid("id").primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => catalogCategories.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  itemKind: text("item_kind").notNull(),
  unit: text("unit").notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  costPrice: numeric("cost_price", { precision: 24, scale: 10 }).notNull(),
  salePrice: numeric("sale_price", { precision: 24, scale: 10 }).notNull(),
  isDeliverable: boolean("is_deliverable").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
}, (table) => [
  index("catalog_items_category_idx").on(table.categoryId),
  index("catalog_items_active_idx").on(table.isActive),
  index("catalog_items_kind_idx").on(table.itemKind)
]);
