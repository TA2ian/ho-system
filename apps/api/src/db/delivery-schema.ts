import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer-schema.js";
import { invoices } from "./invoice-schema.js";
import { salesOrders } from "./sales-schema.js";
import { users } from "./schema.js";
import { payments } from "./payment-schema.js";

export const deliveryOrders = pgTable("delivery_orders", {
  id: uuid("id").primaryKey(),
  deliveryNumber: text("delivery_number").notNull().unique(),
  deliveryType: text("delivery_type").notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  assignedDriverId: uuid("assigned_driver_id").references(() => users.id),
  status: text("status").notNull(),
  address: text("address"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  outForDeliveryAt: timestamp("out_for_delivery_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("delivery_orders_customer_idx").on(table.customerId),
  index("delivery_orders_invoice_idx").on(table.invoiceId),
  index("delivery_orders_driver_idx").on(table.assignedDriverId),
  index("delivery_orders_status_idx").on(table.status),
  index("delivery_orders_type_status_idx").on(table.deliveryType, table.status)
]);

export const deliveryOrderPayments = pgTable("delivery_order_payments", {
  id: uuid("id").primaryKey(),
  deliveryOrderId: uuid("delivery_order_id").notNull().references(() => deliveryOrders.id),
  paymentId: uuid("payment_id").notNull().unique().references(() => payments.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("delivery_order_payments_delivery_idx").on(table.deliveryOrderId),
  uniqueIndex("delivery_order_payments_payment_uq").on(table.paymentId)
]);
