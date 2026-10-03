import { date, index, numeric, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";
import { invoices } from "./invoice-schema.js";
import { currencies, users } from "./schema.js";

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey(),
  campaignNumber: text("campaign_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  partnerUserId: uuid("partner_user_id").references(() => users.id),
  name: text("name").notNull(),
  status: text("status").notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  grossAmount: numeric("gross_amount", { precision: 24, scale: 10 }).notNull(),
  plannedAdSpend: numeric("planned_ad_spend", { precision: 24, scale: 10 }).notNull(),
  managementFeeAmount: numeric("management_fee_amount", { precision: 24, scale: 10 }).notNull(),
  partnerSharePercent: numeric("partner_share_percent", { precision: 7, scale: 4 }).notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("campaigns_customer_idx").on(table.customerId),
  index("campaigns_partner_idx").on(table.partnerUserId),
  index("campaigns_status_idx").on(table.status)
]);

export const campaignInvoices = pgTable("campaign_invoices", {
  id: uuid("id").primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  invoiceId: uuid("invoice_id").notNull().unique().references(() => invoices.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("campaign_invoices_pair_uq").on(table.campaignId, table.invoiceId),
  index("campaign_invoices_campaign_idx").on(table.campaignId)
]);

export const campaignSpendEntries = pgTable("campaign_spend_entries", {
  id: uuid("id").primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  amount: numeric("amount", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  spentAt: timestamp("spent_at", { withTimezone: true }).notNull(),
  reference: text("reference"),
  notes: text("notes"),
  recordedBy: uuid("recorded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("campaign_spend_campaign_idx").on(table.campaignId),
  index("campaign_spend_spent_at_idx").on(table.spentAt)
]);

export const campaignSpendReversals = pgTable("campaign_spend_reversals", {
  id: uuid("id").primaryKey(),
  spendId: uuid("spend_id").notNull().unique().references(() => campaignSpendEntries.id),
  reason: text("reason").notNull(),
  reversedBy: uuid("reversed_by").notNull().references(() => users.id),
  reversedAt: timestamp("reversed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("campaign_spend_reversals_spend_idx").on(table.spendId),
  index("campaign_spend_reversals_reversed_at_idx").on(table.reversedAt)
]);
