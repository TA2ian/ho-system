import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  date,
} from 'drizzle-orm/pg-core';

// 1. Identity & RBAC
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').notNull().default('VIEWER'), // SUPER_ADMIN, ADMIN, ACCOUNTANT, MEDIA_MANAGER, DELIVERY_MANAGER, EMPLOYEE, DRIVER, ADVERTISER, VIEWER
  status: text('status').notNull().default('ACTIVE'), // ACTIVE, INACTIVE
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. CRM (Customers)
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  status: text('status').notNull().default('LEAD'), // LEAD, ACTIVE, INACTIVE, ARCHIVED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Catalog (Products and Services)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  description: text('description'),
  category: text('category'), // e.g. "Software", "Hardware", "Ad Campaign", "Courier"
  type: text('type').notNull().default('PRODUCT'), // PRODUCT, SERVICE, MEDIA_BUYING, DELIVERY
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0.00'),
  status: text('status').notNull().default('ACTIVE'), // ACTIVE, INACTIVE
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Sales Orders
export const salesOrders = pgTable('sales_orders', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  orderNumber: text('order_number').notNull().unique(),
  status: text('status').notNull().default('DRAFT'), // DRAFT, CONFIRMED, PARTIALLY_FULFILLED, FULFILLED, CANCELLED
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sales Order Items
export const salesOrderItems = pgTable('sales_order_items', {
  id: serial('id').primaryKey(),
  salesOrderId: integer('sales_order_id')
    .references(() => salesOrders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Invoices
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  salesOrderId: integer('sales_order_id')
    .references(() => salesOrders.id),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  status: text('status').notNull().default('DRAFT'), // DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  dueDate: date('due_date'),
  issuedAt: timestamp('issued_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Invoice Items
export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Receivables
export const receivables = pgTable('receivables', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id)
    .notNull(),
  status: text('status').notNull().default('OPEN'), // OPEN, PARTIALLY_PAID, PAID, WRITTEN_OFF
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  remainingAmount: numeric('remaining_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. System Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid'), // Firebase uid of user or system
  actorEmail: text('actor_email'),
  action: text('action').notNull(), // e.g. "CREATE_CUSTOMER", "CONFIRM_SALES_ORDER"
  entityType: text('entity_type').notNull(), // e.g. "customer", "sales_order"
  entityId: text('entity_id'),
  beforeState: text('before_state'), // JSON snapshot
  afterState: text('after_state'), // JSON snapshot
  requestId: text('request_id'),
  sessionId: text('session_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Relationships configuration
export const usersRelations = relations(users, () => ({}));

export const customersRelations = relations(customers, ({ many }) => ({
  salesOrders: many(salesOrders),
  invoices: many(invoices),
  receivables: many(receivables),
}));

export const productsRelations = relations(products, () => ({}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  items: many(salesOrderItems),
  invoices: many(invoices),
}));

export const salesOrderItemsRelations = relations(salesOrderItems, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderItems.salesOrderId],
    references: [salesOrders.id],
  }),
  product: one(products, {
    fields: [salesOrderItems.productId],
    references: [products.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  salesOrder: one(salesOrders, {
    fields: [invoices.salesOrderId],
    references: [salesOrders.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  items: many(invoiceItems),
  receivables: many(receivables),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

export const receivablesRelations = relations(receivables, ({ one }) => ({
  customer: one(customers, {
    fields: [receivables.customerId],
    references: [customers.id],
  }),
  invoice: one(invoices, {
    fields: [receivables.invoiceId],
    references: [invoices.id],
  }),
}));
