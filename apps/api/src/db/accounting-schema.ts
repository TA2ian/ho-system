import { date, index, numeric, pgTable, text, timestamp, uuid, uniqueIndex, integer, boolean } from "drizzle-orm/pg-core";
import { currencies, users } from "./schema.js";
import { customers } from "./customer-schema.js";

export const accountingPeriods = pgTable("accounting_periods", {
  id: uuid("id").primaryKey(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: text("status").notNull(),
  closedAt: timestamp("closed_at",{withTimezone:true}),
  closedBy: uuid("closed_by").references(()=>users.id),
  createdBy: uuid("created_by").notNull().references(()=>users.id),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
}, table=>[index("accounting_periods_status_idx").on(table.status),uniqueIndex("accounting_periods_start_uq").on(table.periodStart)]);

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: uuid("id").primaryKey(), code:text("code").notNull().unique(), name:text("name").notNull(),
  accountType:text("account_type").notNull(), normalBalance:text("normal_balance").notNull(),
  parentId:uuid("parent_id"), isActive:boolean("is_active").notNull().default(true), createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},table=>[index("chart_of_accounts_type_idx").on(table.accountType),index("chart_of_accounts_parent_idx").on(table.parentId)]);

export const journalEntries = pgTable("journal_entries", {
  id:uuid("id").primaryKey(), entryNumber:text("entry_number").notNull().unique(), status:text("status").notNull(),
  entryDate:date("entry_date").notNull(), accountingPeriodId:uuid("accounting_period_id").notNull().references(()=>accountingPeriods.id),
  currencyCode:text("currency_code").notNull().references(()=>currencies.code), exchangeRateToBase:numeric("exchange_rate_to_base",{precision:24,scale:10}).notNull(),
  baseCurrencyCode:text("base_currency_code").notNull().references(()=>currencies.code), description:text("description").notNull(),
  sourceType:text("source_type"), sourceId:text("source_id"), sourceEventKey:text("source_event_key").unique(),
  reversesEntryId:uuid("reverses_entry_id"), createdBy:uuid("created_by").notNull().references(()=>users.id),
  postedBy:uuid("posted_by").references(()=>users.id), postedAt:timestamp("posted_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},table=>[index("journal_entries_date_idx").on(table.entryDate),index("journal_entries_status_idx").on(table.status),index("journal_entries_source_idx").on(table.sourceType,table.sourceId)]);

export const journalLines = pgTable("journal_lines", {
  id:uuid("id").primaryKey(), journalEntryId:uuid("journal_entry_id").notNull().references(()=>journalEntries.id),
  lineNumber:integer("line_number").notNull(), accountId:uuid("account_id").notNull().references(()=>chartOfAccounts.id),
  currencyCode:text("currency_code").notNull().references(()=>currencies.code),
  debitAmount:numeric("debit_amount",{precision:24,scale:10}).notNull().default("0"),
  creditAmount:numeric("credit_amount",{precision:24,scale:10}).notNull().default("0"),
  baseDebitAmount:numeric("base_debit_amount",{precision:24,scale:10}).notNull().default("0"),
  baseCreditAmount:numeric("base_credit_amount",{precision:24,scale:10}).notNull().default("0"),
  description:text("description"),customerId:uuid("customer_id").references(()=>customers.id),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow()
},table=>[uniqueIndex("journal_lines_entry_line_uq").on(table.journalEntryId,table.lineNumber),index("journal_lines_entry_idx").on(table.journalEntryId),index("journal_lines_account_idx").on(table.accountId),index("journal_lines_customer_idx").on(table.customerId)]);
