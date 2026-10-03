import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";

export const customerBusinessProfiles = pgTable("customer_business_profiles", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").notNull().unique().references(() => customers.id),
  legalName: text("legal_name"),
  registrationNumber: text("registration_number"),
  taxNumber: text("tax_number"),
  industry: text("industry"),
  website: text("website"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("customer_business_profiles_customer_idx").on(table.customerId)
]);
