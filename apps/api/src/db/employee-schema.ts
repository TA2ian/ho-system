import { boolean, index, numeric, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { currencies, users } from "./schema.js";
import { salesOrders } from "./sales-schema.js";

export const employeeCompensationRules = pgTable("employee_compensation_rules", {
  id: uuid("id").primaryKey(),
  employeeUserId: uuid("employee_user_id").notNull().references(() => users.id),
  saleType: text("sale_type"),
  method: text("method").notNull(),
  ratePercent: numeric("rate_percent", { precision: 7, scale: 4 }),
  fixedAmount: numeric("fixed_amount", { precision: 24, scale: 10 }),
  currencyCode: text("currency_code").references(() => currencies.code),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("compensation_rules_employee_idx").on(table.employeeUserId),
  uniqueIndex("compensation_rules_active_sale_uq").on(table.employeeUserId, table.saleType),
  uniqueIndex("compensation_rules_active_salary_uq").on(table.employeeUserId)
]);

export const employeeTasks = pgTable("employee_tasks", {
  id: uuid("id").primaryKey(),
  employeeUserId: uuid("employee_user_id").notNull().references(() => users.id),
  taskType: text("task_type").notNull(),
  saleType: text("sale_type"),
  sourceSalesOrderId: uuid("source_sales_order_id").references(() => salesOrders.id),
  basisAmount: numeric("basis_amount", { precision: 24, scale: 10 }).notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  status: text("status").notNull(),
  compensationRuleId: uuid("compensation_rule_id").references(() => employeeCompensationRules.id),
  compensationAmount: numeric("compensation_amount", { precision: 24, scale: 10 }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("employee_tasks_employee_idx").on(table.employeeUserId),
  index("employee_tasks_status_idx").on(table.status),
  index("employee_tasks_sale_type_idx").on(table.saleType)
]);
