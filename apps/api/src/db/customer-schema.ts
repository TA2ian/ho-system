import {
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey(),
  type: text("type").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("customers_status_idx").on(table.status),
  index("customers_display_name_idx").on(table.displayName)
]);
