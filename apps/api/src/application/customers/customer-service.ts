import { randomUUID } from "node:crypto";
import type { Database } from "../../db/client.js";
import { customers } from "../../db/customer-schema.js";
import { eq } from "drizzle-orm";
import type { Customer } from "../../domain/customer.js";

export interface CreateCustomerInput {
  type: Customer["type"];
  displayName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

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
  return row as Customer;
}

export async function listCustomers(db: Database): Promise<Customer[]> {
  return db.select().from(customers).where(eq(customers.status, "active")) as Promise<Customer[]>;
}
