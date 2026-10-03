import { date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";
import { currencies, users } from "./schema.js";

export const mediaAgreements = pgTable("media_agreements", {
  id: uuid("id").primaryKey(),
  agreementNumber: text("agreement_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  status: text("status").notNull(),
  clientPrice: numeric("client_price", { precision: 24, scale: 10 }).notNull(),
  advertisingBudget: numeric("advertising_budget", { precision: 24, scale: 10 }).notNull(),
  managementComponent: numeric("management_component", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  paymentTerms: text("payment_terms"),
  accountingPolicy: text("accounting_policy"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("media_agreements_customer_idx").on(table.customerId),
  index("media_agreements_status_idx").on(table.status),
  index("media_agreements_dates_idx").on(table.startsOn, table.endsOn)
]);
