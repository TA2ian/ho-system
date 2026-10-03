import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { currencies, users } from "./schema.js";

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey(),
  expenseNumber: text("expense_number").notNull().unique(),
  category: text("category").notNull(),
  vendorName: text("vendor_name"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull(),
  incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidBy: uuid("paid_by").references(() => users.id),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("expenses_category_idx").on(table.category),
  index("expenses_status_idx").on(table.status),
  index("expenses_incurred_at_idx").on(table.incurredAt),
  index("expenses_currency_idx").on(table.currencyCode)
]);
