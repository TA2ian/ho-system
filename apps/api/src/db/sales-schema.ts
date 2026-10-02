import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";
import { catalogItems } from "./catalog-schema.js";
import { currencies, users } from "./schema.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  index("sales_orders_customer_idx").on(table.customerId),
  index("sales_orders_status_idx").on(table.status)
]);

export const salesOrderLines = pgTable("sales_order_lines", {
  id: uuid("id").primaryKey(),
  salesOrderId: uuid("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  catalogItemId: uuid("catalog_item_id").notNull().references(() => catalogItems.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 24, scale: 10 }).notNull(),
  unit: text("unit").notNull(),
  unitCost: numeric("unit_cost", { precision: 24, scale: 10 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("sales_order_lines_order_line_uq").on(table.salesOrderId, table.lineNumber),
  index("sales_order_lines_order_idx").on(table.salesOrderId)
]);
