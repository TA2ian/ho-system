import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const customerPhones = pgTable("customer_phones", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  phone: text("phone").notNull(),
  label: text("label"),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  ...timestamps
}, (table) => [
  index("customer_phones_customer_idx").on(table.customerId),
  uniqueIndex("customer_phones_identity_uq").on(table.customerId, table.phone)
]);

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  label: text("label"),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  countryCode: text("country_code"),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  ...timestamps
}, (table) => [
  index("customer_addresses_customer_idx").on(table.customerId)
]);

export const customerSocialAccounts = pgTable("customer_social_accounts", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  platform: text("platform").notNull(),
  accountIdentifier: text("account_identifier").notNull(),
  profileUrl: text("profile_url"),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  ...timestamps
}, (table) => [
  index("customer_social_accounts_customer_idx").on(table.customerId),
  uniqueIndex("customer_social_accounts_identity_uq").on(table.customerId, table.platform, table.accountIdentifier)
]);
