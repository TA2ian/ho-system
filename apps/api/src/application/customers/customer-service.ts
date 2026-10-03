import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { customers } from "../../db/customer-schema.js";
import { recordAuditEvent } from "../audit.js";
import type { Customer } from "../../domain/customer.js";
import { ApplicationError } from "../../domain/errors.js";
import { pageRows, type Pagination } from "../pagination.js";

export const createCustomerInputSchema = z.object({
  type: z.enum(["individual", "business"]),
  displayName: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    ...row,
    type: row.type as Customer["type"],
    status: row.status as Customer["status"]
  };
}

export async function createCustomer(
  db: Database,
  input: CreateCustomerInput,
  context: {
    actorId: string;
    requestId: string;
    idempotencyKey: string;
  }
): Promise<Customer> {
  const id = randomUUID();

  const [row] = await db.insert(customers).values({
    id,
    type: input.type,
    displayName: input.displayName.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    notes: input.notes?.trim() || null,
    status: "active"
  }).returning();

  if (!row) throw new ApplicationError(
    "CUSTOMER_CREATE_FAILED",
    500,
    "تعذر إنشاء العميل"
  );

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "customer.created",
    resourceType: "customer",
    resourceId: id,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey
  });

  return toCustomer(row);
}

export async function listCustomers(db: Database, pagination: Pagination) {
  const rows = await db.select().from(customers)
    .where(eq(customers.status, "active"))
    .limit(pagination.limit + 1)
    .offset(pagination.offset);
  const page = pageRows(rows.map(toCustomer), pagination);
  return page;
}
