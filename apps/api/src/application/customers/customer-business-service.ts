import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { customerBusinessProfiles } from "../../db/customer-business-schema.js";
import { customers } from "../../db/customer-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";

export const upsertCustomerBusinessProfileInputSchema = z.object({
  legalName: z.string().trim().max(255).nullable().optional(),
  registrationNumber: z.string().trim().max(100).nullable().optional(),
  taxNumber: z.string().trim().max(100).nullable().optional(),
  industry: z.string().trim().max(255).nullable().optional(),
  website: z.string().trim().url().max(2048).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export async function getCustomerBusinessProfile(db: Database, customerId: string) {
  const [row] = await db.select().from(customerBusinessProfiles)
    .where(eq(customerBusinessProfiles.customerId, customerId)).limit(1);
  return row ?? null;
}

export async function upsertCustomerBusinessProfile(
  db: Database,
  customerId: string,
  input: z.infer<typeof upsertCustomerBusinessProfileInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string }
) {
  const [customer] = await db.select({ id: customers.id, type: customers.type })
    .from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود");
  if (customer.type !== "business") throw new ApplicationError("CUSTOMER_BUSINESS_PROFILE_INVALID", 409, "ملف معلومات النشاط التجاري متاح للعملاء من نوع business فقط");

  const values = {
    legalName: input.legalName?.trim() || null,
    registrationNumber: input.registrationNumber?.trim() || null,
    taxNumber: input.taxNumber?.trim() || null,
    industry: input.industry?.trim() || null,
    website: input.website?.trim() || null,
    notes: input.notes?.trim() || null,
    updatedAt: new Date()
  };

  const [existing] = await db.select({ id: customerBusinessProfiles.id })
    .from(customerBusinessProfiles).where(eq(customerBusinessProfiles.customerId, customerId)).limit(1);

  const [row] = existing
    ? await db.update(customerBusinessProfiles).set(values).where(eq(customerBusinessProfiles.id, existing.id)).returning()
    : await db.insert(customerBusinessProfiles).values({ id: randomUUID(), customerId, ...values }).returning();

  if (!row) throw new ApplicationError("CUSTOMER_BUSINESS_PROFILE_SAVE_FAILED", 500, "تعذر حفظ معلومات النشاط التجاري");

  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: existing ? "customer.business_profile.updated" : "customer.business_profile.created",
    resourceType: "customer",
    resourceId: customerId,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey
  });

  return row;
}
