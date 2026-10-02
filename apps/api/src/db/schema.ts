import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const currencies = pgTable("currencies", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  minorUnit: smallint("minor_unit").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
}, (table) => [
  index("currencies_active_idx").on(table.isActive)
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: uuid("id").primaryKey(),
  scope: text("scope").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status").notNull(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
}, (table) => [
  uniqueIndex("idempotency_scope_key_uq").on(table.scope, table.idempotencyKey),
  index("idempotency_expires_at_idx").on(table.expiresAt)
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  requestId: text("request_id"),
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("audit_actor_idx").on(table.actorId),
  index("audit_resource_idx").on(table.resourceType, table.resourceId),
  index("audit_created_at_idx").on(table.createdAt)
]);

export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey(),
  baseCurrencyCode: text("base_currency_code").notNull().references(() => currencies.code),
  quoteCurrencyCode: text("quote_currency_code").notNull().references(() => currencies.code),
  rate: numeric("rate", { precision: 24, scale: 10 }).notNull(),
  source: text("source").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("exchange_rates_pair_observed_idx").on(
    table.baseCurrencyCode,
    table.quoteCurrencyCode,
    table.observedAt
  )
]);
