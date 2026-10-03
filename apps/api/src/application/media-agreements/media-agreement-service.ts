import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { customers } from "../../db/customer-schema.js";
import { mediaAgreements } from "../../db/media-agreement-schema.js";
import { currencies } from "../../db/schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";
import { pageRows, type Pagination } from "../pagination.js";

const amount = z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v => new Decimal(v).gte(0), "المبلغ يجب ألا يكون سالباً");
const status = z.enum(["draft", "active", "suspended", "expired", "terminated"]);

export const createMediaAgreementInputSchema = z.object({
  customerId: z.string().uuid(),
  agreementNumber: z.string().trim().min(1).max(100),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: status.default("draft"),
  clientPrice: amount,
  advertisingBudget: amount,
  managementComponent: amount,
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  paymentTerms: z.string().trim().max(2000).nullable().optional(),
  accountingPolicy: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
}).superRefine((v, ctx) => {
  if (v.endsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: "تاريخ نهاية الاتفاقية يجب ألا يسبق بدايتها" });
});

export async function listMediaAgreements(db: Database, pagination: Pagination, customerId?: string) {
  const rows = await db.select().from(mediaAgreements)
    .where(customerId ? eq(mediaAgreements.customerId, customerId) : undefined)
    .orderBy(asc(mediaAgreements.startsOn), asc(mediaAgreements.createdAt))
    .limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}

export async function getMediaAgreement(db: Database, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new ApplicationError("MEDIA_AGREEMENT_ID_INVALID", 400, "معرّف الاتفاقية غير صالح");
  const [row] = await db.select().from(mediaAgreements).where(eq(mediaAgreements.id, id)).limit(1);
  if (!row) throw new ApplicationError("MEDIA_AGREEMENT_NOT_FOUND", 404, "الاتفاقية غير موجودة");
  return row;
}

export async function createMediaAgreement(db: Database, input: z.infer<typeof createMediaAgreementInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  const [customer] = await db.select({ id: customers.id }).from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.status, "active"))).limit(1);
  if (!customer) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود أو غير فعال");

  const [currency] = await db.select({ code: currencies.code }).from(currencies)
    .where(and(eq(currencies.code, input.currencyCode), eq(currencies.isActive, true))).limit(1);
  if (!currency) throw new ApplicationError("CURRENCY_NOT_FOUND", 404, "العملة غير موجودة أو غير فعالة");

  const [existing] = await db.select({ id: mediaAgreements.id }).from(mediaAgreements)
    .where(eq(mediaAgreements.agreementNumber, input.agreementNumber.trim())).limit(1);
  if (existing) throw new ApplicationError("MEDIA_AGREEMENT_NUMBER_EXISTS", 409, "رقم الاتفاقية مستخدم مسبقاً");

  const id = randomUUID();
  const [row] = await db.insert(mediaAgreements).values({
    id,
    agreementNumber: input.agreementNumber.trim(),
    customerId: input.customerId,
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? null,
    status: input.status,
    clientPrice: input.clientPrice,
    advertisingBudget: input.advertisingBudget,
    managementComponent: input.managementComponent,
    currencyCode: input.currencyCode,
    paymentTerms: input.paymentTerms?.trim() || null,
    accountingPolicy: input.accountingPolicy?.trim() || null,
    notes: input.notes?.trim() || null,
    createdBy: context.actorId
  }).returning();

  if (!row) throw new ApplicationError("MEDIA_AGREEMENT_CREATE_FAILED", 500, "تعذر إنشاء الاتفاقية");
  await recordAuditEvent(db, {
    actorId: context.actorId,
    action: "media_agreement.created",
    resourceType: "media_agreement",
    resourceId: id,
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    metadata: { agreementNumber: row.agreementNumber, customerId: row.customerId }
  });
  return row;
}
