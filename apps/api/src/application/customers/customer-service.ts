import { randomUUID } from "node:crypto";
import type { Database } from "../../db/client.js";
import { customers } from "../../db/customer-schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Customer } from "../../domain/customer.js";

export const createCustomerInputSchema = z.object({
  type: z.enum(["individual", "business"]),
  displayName: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

export async function createCustomer(
  db: Database,
  input: CreateCustomerInput
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

  if (!row) throw new Error("CUSTOMER_CREATE_FAILED");
  return {
    ...row,
    type: row.type as Customer["type"],
    status: row.status as Customer["status"]
  };
}

export async function listCustomers(db: Database): Promise<Customer[]> {
  const rows = await db.select().from(customers).where(eq(customers.status, "active"));
  return rows.map((row) => ({
    ...row,
    type: row.type as Customer["type"],
    status: row.status as Customer["status"]
  }));
}
