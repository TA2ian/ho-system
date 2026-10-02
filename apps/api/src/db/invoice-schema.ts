import {
  date,
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
import { salesOrderLines, salesOrders } from "./sales-schema.js";
import { currencies, users } from "./schema.js";

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  sourceSalesOrderId: uuid("source_sales_order_id").unique().references(() => salesOrders.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: text("status").notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  totalAmount: numeric("total_amount", { precision: 24, scale: 10 }).notNull(),
  issueDate: date("issue_date"),
  dueDate: date("due_date"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("invoices_customer_idx").on(table.customerId),
  index("invoices_status_idx").on(table.status),
  index("invoices_due_date_idx").on(table.dueDate)
]);

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  salesOrderLineId: uuid("sales_order_line_id").notNull().references(() => salesOrderLines.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 24, scale: 10 }).notNull(),
  unit: text("unit").notNull(),
  unitPrice: numeric("unit_price", { precision: 24, scale: 10 }).notNull(),
  lineTotal: numeric("line_total", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("invoice_lines_invoice_line_uq").on(table.invoiceId, table.lineNumber),
  index("invoice_lines_invoice_idx").on(table.invoiceId)
]);
