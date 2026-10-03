import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { customerAddresses, customerPhones, customerSocialAccounts } from "../../db/customer-360-schema.js";
import { customers } from "../../db/customer-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";
import { pageRows, type Pagination } from "../pagination.js";

const uuid = z.string().uuid();
const baseContext = z.object({ customerId: uuid });

export const createCustomerPhoneInputSchema = z.object({
  phone: z.string().trim().min(3).max(50),
  label: z.string().trim().max(100).nullable().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});
export const createCustomerAddressInputSchema = z.object({
  label: z.string().trim().max(100).nullable().optional(),
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(40).nullable().optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).nullable().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});
export const createCustomerSocialAccountInputSchema = z.object({
  platform: z.string().trim().min(1).max(50),
  accountIdentifier: z.string().trim().min(1).max(255),
  profileUrl: z.string().trim().url().max(2048).nullable().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

async function assertCustomer(db: Database, customerId: string) {
  const [row] = await db.select({ id: customers.id, status: customers.status }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!row) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود");
  return row;
}

export async function listCustomerPhones(db: Database, customerId: string, pagination: Pagination) {
  await assertCustomer(db, customerId);
  const rows = await db.select().from(customerPhones).where(eq(customerPhones.customerId, customerId)).orderBy(customerPhones.createdAt).limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}
export async function listCustomerAddresses(db: Database, customerId: string, pagination: Pagination) {
  await assertCustomer(db, customerId);
  const rows = await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customerId)).orderBy(customerAddresses.createdAt).limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}
export async function listCustomerSocialAccounts(db: Database, customerId: string, pagination: Pagination) {
  await assertCustomer(db, customerId);
  const rows = await db.select().from(customerSocialAccounts).where(eq(customerSocialAccounts.customerId, customerId)).orderBy(customerSocialAccounts.createdAt).limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}

async function clearPrimaryPhones(db: Database, customerId: string) {
  await db.update(customerPhones).set({ isPrimary: false }).where(eq(customerPhones.customerId, customerId));
}
async function clearPrimaryAddresses(db: Database, customerId: string) {
  await db.update(customerAddresses).set({ isPrimary: false }).where(eq(customerAddresses.customerId, customerId));
}
async function clearPrimarySocialAccounts(db: Database, customerId: string, platform: string) {
  await db.update(customerSocialAccounts).set({ isPrimary: false }).where(and(
    eq(customerSocialAccounts.customerId, customerId),
    eq(customerSocialAccounts.platform, platform)
  ));
}


export async function createCustomerPhone(db: Database, customerId: string, input: z.infer<typeof createCustomerPhoneInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  await assertCustomer(db, customerId);
  if (input.isPrimary) await clearPrimaryPhones(db, customerId);
  const [row] = await db.insert(customerPhones).values({ id: randomUUID(), customerId, phone: input.phone.trim(), label: input.label?.trim() || null, isPrimary: input.isPrimary ?? false, notes: input.notes?.trim() || null }).returning();
  if (!row) throw new ApplicationError("CUSTOMER_PHONE_CREATE_FAILED", 500, "تعذر إضافة رقم الهاتف");
  await recordAuditEvent(db, { actorId: context.actorId, action: "customer.phone.created", resourceType: "customer", resourceId: customerId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { phoneId: row.id } });
  return row;
}
export async function createCustomerAddress(db: Database, customerId: string, input: z.infer<typeof createCustomerAddressInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  await assertCustomer(db, customerId);
  if (input.isPrimary) await clearPrimaryAddresses(db, customerId);
  const [row] = await db.insert(customerAddresses).values({ id: randomUUID(), customerId, label: input.label?.trim() || null, addressLine1: input.addressLine1.trim(), addressLine2: input.addressLine2?.trim() || null, city: input.city?.trim() || null, region: input.region?.trim() || null, postalCode: input.postalCode?.trim() || null, countryCode: input.countryCode?.trim().toUpperCase() || null, isPrimary: input.isPrimary ?? false, notes: input.notes?.trim() || null }).returning();
  if (!row) throw new ApplicationError("CUSTOMER_ADDRESS_CREATE_FAILED", 500, "تعذر إضافة العنوان");
  await recordAuditEvent(db, { actorId: context.actorId, action: "customer.address.created", resourceType: "customer", resourceId: customerId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { addressId: row.id } });
  return row;
}
export async function createCustomerSocialAccount(db: Database, customerId: string, input: z.infer<typeof createCustomerSocialAccountInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  await assertCustomer(db, customerId);
  if (input.isPrimary) await clearPrimarySocialAccounts(db, customerId, input.platform.trim().toLowerCase());
  const [row] = await db.insert(customerSocialAccounts).values({ id: randomUUID(), customerId, platform: input.platform.trim().toLowerCase(), accountIdentifier: input.accountIdentifier.trim(), profileUrl: input.profileUrl?.trim() || null, isPrimary: input.isPrimary ?? false, notes: input.notes?.trim() || null }).returning();
  if (!row) throw new ApplicationError("CUSTOMER_SOCIAL_CREATE_FAILED", 500, "تعذر إضافة الحساب الاجتماعي");
  await recordAuditEvent(db, { actorId: context.actorId, action: "customer.social_account.created", resourceType: "customer", resourceId: customerId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { socialAccountId: row.id, platform: row.platform } });
  return row;
}
