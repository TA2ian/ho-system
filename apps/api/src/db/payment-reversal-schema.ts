import { numeric, pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { currencies, users } from "./schema.js";
import { paymentAllocations } from "./payment-schema.js";

export const paymentAllocationReversals = pgTable("payment_allocation_reversals", {
  id: uuid("id").primaryKey(),
  paymentAllocationId: uuid("payment_allocation_id").notNull().references(() => paymentAllocations.id),
  amount: numeric("amount", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  reason: text("reason").notNull(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }).notNull().defaultNow(),
  reversedBy: uuid("reversed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("payment_allocation_reversals_allocation_idx").on(table.paymentAllocationId)
]);
