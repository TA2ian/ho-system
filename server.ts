// server.ts
import express, { Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { db } from './src/db/index.ts';
import {
  customers as customersTable,
  products as productsTable,
  salesOrders as salesOrdersTable,
  salesOrderItems as salesOrderItemsTable,
  invoices as invoicesTable,
  invoiceItems as invoiceItemsTable,
  receivables as receivablesTable,
  auditLogs as auditLogsTable,
  users as usersTable,
} from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireRoles, AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Helper for generating custom human-readable document numbers
function generateDocNumber(prefix: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${randStr}`;
}

// 1. IDENTITY & RBAC
// Get current user details and DB sync
app.get('/api/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({
    firebaseUser: req.user,
    dbUser: req.dbUser,
  });
});

// Get all registered users (ADMIN only)
app.get('/api/users', requireAuth, requireRoles(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    res.json(list);
  } catch (error: any) {
    console.error('Failed to get users:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve users' });
  }
});

// Update user role (SUPER_ADMIN or ADMIN only, and cannot change own role unless SUPER_ADMIN)
app.put('/api/users/:uid/role', requireAuth, requireRoles(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { uid } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  // Prevent admin from changing their own role to something else
  if (req.dbUser?.uid === uid && req.dbUser?.role !== 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'You cannot modify your own role' });
  }

  try {
    const updated = await db.update(usersTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(usersTable.uid, uid))
      .returning();

    // Create Audit Log
    await db.insert(auditLogsTable).values({
      actorUid: req.dbUser?.uid || 'system',
      actorEmail: req.dbUser?.email || '',
      action: 'UPDATE_USER_ROLE',
      entityType: 'user',
      entityId: uid,
      beforeState: JSON.stringify({ uid }),
      afterState: JSON.stringify({ role }),
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update user role:', error);
    res.status(500).json({ error: error.message || 'Failed to update user role' });
  }
});

// 2. CRM (Customers)
// GET all customers
app.get('/api/customers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.select().from(customersTable).orderBy(desc(customersTable.createdAt));
    res.json(list);
  } catch (error: any) {
    console.error('Failed to retrieve customers:', error);
    res.status(500).json({ error: 'Failed to retrieve customers', details: error.message });
  }
});

// POST create customer
app.post('/api/customers', requireAuth, requireRoles(['ADMIN', 'ACCOUNTANT']), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, address, notes, status } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  try {
    const created = await db.insert(customersTable)
      .values({
        name,
        email,
        phone,
        address,
        notes,
        status: status || 'LEAD',
      })
      .returning();

    // Audit log
    await db.insert(auditLogsTable).values({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'CREATE_CUSTOMER',
      entityType: 'customer',
      entityId: String(created[0].id),
      afterState: JSON.stringify(created[0]),
    });

    res.status(210).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create customer:', error);
    res.status(500).json({ error: 'Failed to create customer', details: error.message });
  }
});

// PUT update customer
app.put('/api/customers/:id', requireAuth, requireRoles(['ADMIN', 'ACCOUNTANT']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, address, notes, status } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  try {
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, Number(id)));
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updated = await db.update(customersTable)
      .set({
        name,
        email,
        phone,
        address,
        notes,
        status,
        updatedAt: new Date(),
      })
      .where(eq(customersTable.id, Number(id)))
      .returning();

    // Audit log
    await db.insert(auditLogsTable).values({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'UPDATE_CUSTOMER',
      entityType: 'customer',
      entityId: String(id),
      beforeState: JSON.stringify(existing),
      afterState: JSON.stringify(updated[0]),
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error('Failed to update customer:', error);
    res.status(500).json({ error: 'Failed to update customer', details: error.message });
  }
});

// 3. CATALOG (Products / Services)
app.get('/api/products', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
    res.json(list);
  } catch (error: any) {
    console.error('Failed to retrieve products:', error);
    res.status(500).json({ error: 'Failed to retrieve products', details: error.message });
  }
});

app.post('/api/products', requireAuth, requireRoles(['ADMIN', 'ACCOUNTANT']), async (req: AuthRequest, res: Response) => {
  const { name, sku, description, category, type, price, cost } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ error: 'Product name and SKU are required' });
  }

  try {
    const created = await db.insert(productsTable)
      .values({
        name,
        sku,
        description,
        category,
        type: type || 'PRODUCT',
        price: price || '0.00',
        cost: cost || '0.00',
      })
      .returning();

    // Audit log
    await db.insert(auditLogsTable).values({
      actorUid: req.dbUser?.uid,
      actorEmail: req.dbUser?.email,
      action: 'CREATE_PRODUCT',
      entityType: 'product',
      entityId: String(created[0].id),
      afterState: JSON.stringify(created[0]),
    });

    res.status(210).json(created[0]);
  } catch (error: any) {
    console.error('Failed to create product:', error);
    res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

// 4. SALES ORDERS & THE VERTICAL FLOW
// GET all sales orders
app.get('/api/sales-orders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await db.select().from(salesOrdersTable).orderBy(desc(salesOrdersTable.createdAt));
    
    // Joint lookup for items and customer name
    const result = await Promise.all(
      orders.map(async (order) => {
        const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, order.customerId));
        const items = await db.select().from(salesOrderItemsTable).where(eq(salesOrderItemsTable.salesOrderId, order.id));
        
        // Include product info
        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
            return { ...item, product };
          })
        );

        return {
          ...order,
          customer,
          items: itemsWithProducts,
        };
      })
    );

    res.json(result);
  } catch (error: any) {
    console.error('Failed to retrieve sales orders:', error);
    res.status(500).json({ error: 'Failed to retrieve sales orders', details: error.message });
  }
});

// POST Sales Order (DRAFT state initially)
app.post('/api/sales-orders', requireAuth, requireRoles(['ADMIN', 'ACCOUNTANT', 'MEDIA_MANAGER']), async (req: AuthRequest, res: Response) => {
  const { customerId, items, notes } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Sales order must have at least one product/item' });
  }

  try {
    // Check if customer exists and is active
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, Number(customerId)));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Atomic database transaction to construct Sales Order and Items
    const result = await db.transaction(async (tx) => {
      // 1. Resolve and calculate total pricing based on actual server-side database catalog (DO NOT trust client price input!)
      let totalSum = 0;
      const orderItemsToInsert: any[] = [];

      for (const reqItem of items) {
        const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, Number(reqItem.productId)));
        if (!product) {
          throw new Error(`Product not found with ID ${reqItem.productId}`);
        }
        if (product.status === 'INACTIVE') {
          throw new Error(`Product '${product.name}' is inactive and cannot be ordered`);
        }

        const qty = Number(reqItem.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid quantity ${reqItem.quantity} for product '${product.name}'`);
        }

        const unitPrice = product.price; // Retrieve trusted price from DB catalog
        const itemTotal = Number(unitPrice) * qty;
        totalSum += itemTotal;

        orderItemsToInsert.push({
          productId: product.id,
          quantity: qty,
          unitPrice: unitPrice,
          totalAmount: String(itemTotal),
        });
      }

      // 2. Insert sales order
      const orderNumber = generateDocNumber('SO');
      const [newOrder] = await tx.insert(salesOrdersTable)
        .values({
          customerId: customer.id,
          orderNumber,
          status: 'DRAFT',
          totalAmount: String(totalSum),
          notes,
        })
        .returning();

      // 3. Insert items linked to order
      const itemsToSave = orderItemsToInsert.map((item) => ({
        ...item,
        salesOrderId: newOrder.id,
      }));

      await tx.insert(salesOrderItemsTable).values(itemsToSave);

      // 4. Audit Log
      await tx.insert(auditLogsTable).values({
        actorUid: req.dbUser?.uid,
        actorEmail: req.dbUser?.email,
        action: 'CREATE_SALES_ORDER_DRAFT',
        entityType: 'sales_order',
        entityId: String(newOrder.id),
        afterState: JSON.stringify({ order: newOrder, items: itemsToSave }),
      });

      return { order: newOrder, items: itemsToSave };
    });

    res.status(210).json(result);
  } catch (error: any) {
    console.error('Failed to create sales order:', error);
    res.status(500).json({ error: 'Failed to create sales order', details: error.message });
  }
});

// Transition Sales Order Status (and automatically generate Invoice + Receivable when CONFIRMED)
app.put('/api/sales-orders/:id/status', requireAuth, requireRoles(['ADMIN', 'ACCOUNTANT']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // e.g. "CONFIRMED" or "CANCELLED"

  if (!status || !['CONFIRMED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: "Invalid status transition. Allowed values: ['CONFIRMED', 'CANCELLED']" });
  }

  try {
    const [existingOrder] = await db.select().from(salesOrdersTable).where(eq(salesOrdersTable.id, Number(id)));
    if (!existingOrder) {
      return res.status(404).json({ error: 'Sales Order not found' });
    }

    if (existingOrder.status !== 'DRAFT') {
      return res.status(400).json({ error: `Cannot transition sales order in state: ${existingOrder.status}` });
    }

    // Atomic transaction for the vertical flow:
    // SalesOrder -> CONFIRMED => generate Invoice => generate Receivable (Receivables table)
    const result = await db.transaction(async (tx) => {
      // 1. Update sales order status
      const [updatedOrder] = await tx.update(salesOrdersTable)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(salesOrdersTable.id, Number(id)))
        .returning();

      // If status is CANCELLED, we just complete and audit
      if (status === 'CANCELLED') {
        await tx.insert(auditLogsTable).values({
          actorUid: req.dbUser?.uid,
          actorEmail: req.dbUser?.email,
          action: 'CANCEL_SALES_ORDER',
          entityType: 'sales_order',
          entityId: String(id),
          beforeState: JSON.stringify(existingOrder),
          afterState: JSON.stringify(updatedOrder),
        });
        return { order: updatedOrder, invoice: null, receivable: null };
      }

      // If status is CONFIRMED, we generate the Invoice and Receivable records
      // Retrieve the order items first
      const orderItems = await tx.select().from(salesOrderItemsTable).where(eq(salesOrderItemsTable.salesOrderId, Number(id)));

      // A. Create the Invoice (ISSUED state)
      const invoiceNumber = generateDocNumber('INV');
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days credit period

      const [newInvoice] = await tx.insert(invoicesTable)
        .values({
          salesOrderId: updatedOrder.id,
          customerId: updatedOrder.customerId,
          invoiceNumber,
          status: 'ISSUED',
          totalAmount: updatedOrder.totalAmount,
          dueDate: dueDate.toISOString().split('T')[0],
          issuedAt: new Date(),
        })
        .returning();

      // Copy Sales Order Items to Invoice Items
      const invoiceItemsToSave = orderItems.map((item) => ({
        invoiceId: newInvoice.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
      }));

      await tx.insert(invoiceItemsTable).values(invoiceItemsToSave);

      // B. Create the Receivable entry
      const [newReceivable] = await tx.insert(receivablesTable)
        .values({
          customerId: updatedOrder.customerId,
          invoiceId: newInvoice.id,
          status: 'OPEN',
          totalAmount: updatedOrder.totalAmount,
          remainingAmount: updatedOrder.totalAmount,
        })
        .returning();

      // C. Audit Logs for CRM events
      await tx.insert(auditLogsTable).values({
        actorUid: req.dbUser?.uid,
        actorEmail: req.dbUser?.email,
        action: 'CONFIRM_SALES_ORDER_AND_GENERATE_RECEIVABLES',
        entityType: 'sales_order',
        entityId: String(id),
        beforeState: JSON.stringify(existingOrder),
        afterState: JSON.stringify({
          order: updatedOrder,
          invoice: newInvoice,
          receivable: newReceivable,
        }),
      });

      return {
        order: updatedOrder,
        invoice: newInvoice,
        receivable: newReceivable,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Failed to transition sales order status:', error);
    res.status(500).json({ error: 'Failed to complete status transition', details: error.message });
  }
});

// 5. INVOICES
// GET all invoices
app.get('/api/invoices', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));
    const result = await Promise.all(
      list.map(async (inv) => {
        const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, inv.customerId));
        const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
        
        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
            return { ...item, product };
          })
        );

        return {
          ...inv,
          customer,
          items: itemsWithProducts,
        };
      })
    );
    res.json(result);
  } catch (error: any) {
    console.error('Failed to retrieve invoices:', error);
    res.status(500).json({ error: 'Failed to retrieve invoices', details: error.message });
  }
});

// 6. RECEIVABLES
// GET all receivables (subledger tracking of unpaid client debt)
app.get('/api/receivables', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await db.select().from(receivablesTable).orderBy(desc(receivablesTable.createdAt));
    const result = await Promise.all(
      list.map(async (rec) => {
        const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, rec.customerId));
        const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, rec.invoiceId));
        return {
          ...rec,
          customer,
          invoice,
        };
      })
    );
    res.json(result);
  } catch (error: any) {
    console.error('Failed to retrieve receivables:', error);
    res.status(500).json({ error: 'Failed to retrieve receivables', details: error.message });
  }
});

// 7. AUDIT LOGS
// GET audit history
app.get('/api/audit-logs', requireAuth, requireRoles(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.timestamp)).limit(200);
    res.json(logs);
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs', details: error.message });
  }
});

// 8. DEV/PRODUCTION FRONTEND HANDLER
if (process.env.NODE_ENV !== 'production') {
  // Vite Server Middleware integration for development hot reloading
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: false, // Disable HMR WebSocket server completely to avoid port/WS conflicts
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Static files presentation in production
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('dist/index.html'));
  });
}

// Start Server on Port 3000
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HO Network Server executing full-stack at http://localhost:${PORT}`);
});
