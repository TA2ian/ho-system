import {
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";
import { currencies, users } from "./schema.js";
import { invoices } from "./invoice-schema.js";

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  paymentNumber: text("payment_number").notNull().unique(),
  status: text("status").notNull(),
  amount: numeric("amount", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  method: text("method").notNull(),
  reference: text("reference"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  receivedBy: uuid("received_by").notNull().references(() => users.id),
  notes: text("notes"),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("payments_customer_idx").on(table.customerId),
  index("payments_status_idx").on(table.status),
  index("payments_received_at_idx").on(table.receivedAt)
]);

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  amount: numeric("amount", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("payment_allocations_payment_invoice_uq").on(table.paymentId, table.invoiceId),
  index("payment_allocations_payment_idx").on(table.paymentId),
  index("payment_allocations_invoice_idx").on(table.invoiceId)
]);
