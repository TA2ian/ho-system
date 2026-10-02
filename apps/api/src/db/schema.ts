import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
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


export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("users_email_uq").on(table.email),
  index("users_status_idx").on(table.status)
]);

export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("auth_identities_provider_subject_uq").on(table.provider, table.subject),
  index("auth_identities_user_idx").on(table.userId)
]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("roles_code_uq").on(table.code)
]);

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("permissions_code_uq").on(table.code)
]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  assignedBy: uuid("assigned_by").references(() => users.id)
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
  index("user_roles_role_idx").on(table.roleId)
]);

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
  index("role_permissions_permission_idx").on(table.permissionId)
]);

export const userAccessScopes = pgTable("user_access_scopes", {
  userId: uuid("user_id").notNull().references(() => users.id),
  scopeType: text("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  grantedBy: uuid("granted_by").references(() => users.id)
}, (table) => [
  primaryKey({ columns: [table.userId, table.scopeType, table.scopeId] }),
  index("user_access_scopes_scope_idx").on(table.scopeType, table.scopeId)
]);
