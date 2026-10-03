import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { campaignInvoices, campaigns, campaignSpendEntries, campaignSpendReversals } from "../../db/campaign-schema.js";
import { customers } from "../../db/customer-schema.js";
import { invoices } from "../../db/invoice-schema.js";
import { roles, userRoles, users } from "../../db/schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";
import { pageRows, type Pagination } from "../pagination.js";
import { postCampaignSpendRecorded, reverseCampaignSpend } from "../accounting/accounting-posting-service.js";

const uuidSchema = z.string().uuid();
const amount = z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v => new Decimal(v).gte(0), "المبلغ يجب ألا يكون سالباً");
const positiveAmount = z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v => new Decimal(v).gt(0), "المبلغ يجب أن يكون أكبر من صفر");

export const createCampaignInputSchema = z.object({
  customerId: uuidSchema,
  partnerUserId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(255),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  grossAmount: amount,
  plannedAdSpend: amount,
  managementFeeAmount: amount,
  partnerSharePercent: z.string().regex(/^\d+(\.\d{1,4})?$/).refine(v => new Decimal(v).gte(0) && new Decimal(v).lte(100), "نسبة الشريك يجب أن تكون بين 0 و100"),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
}).superRefine((v, ctx) => {
  if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: "تاريخ نهاية الحملة يجب ألا يسبق بدايتها" });
});

export const campaignStatusInputSchema = z.object({ status: z.enum(["draft", "planned", "active", "paused", "completed", "cancelled"]) });
export const linkCampaignInvoiceInputSchema = z.object({ invoiceId: uuidSchema });
export const recordCampaignSpendInputSchema = z.object({
  amount: positiveAmount,
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  spentAt: z.string().datetime({ offset: true }).optional(),
  reference: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

const transitionMap: Record<string, string[]> = {
  draft: ["planned", "cancelled"],
  planned: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: []
};

async function getCampaignRow(db: Database, campaignId: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!row) throw new ApplicationError("CAMPAIGN_NOT_FOUND", 404, "الحملة غير موجودة");
  return row;
}
async function assertPartner(db: Database, userId: string) {
  const rows = await db.select({ id: users.id }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.id, userId), eq(users.status, "active"), eq(roles.code, "advertiser"))).limit(1);
  if (!rows[0]) throw new ApplicationError("ADVERTISER_NOT_FOUND", 404, "شريك الإعلانات غير موجود أو غير فعال");
}

async function assertCampaignAccess(db: Database, campaignId: string, actorId: string, privileged: boolean) {
  if (privileged) return;
  const row = await getCampaignRow(db, campaignId);
  if (row.partnerUserId !== actorId) throw new ApplicationError("CAMPAIGN_ACCESS_DENIED", 403, "الحملة ليست ضمن نطاقك");
  return row;
}

export async function createCampaign(db: Database, input: z.infer<typeof createCampaignInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }) {
  const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.status, "active"))).limit(1);
  if (!customer) throw new ApplicationError("CUSTOMER_NOT_FOUND", 404, "العميل غير موجود أو غير فعال");
  if (input.partnerUserId) await assertPartner(db, input.partnerUserId);
  const id = randomUUID();
  const campaignNumber = "CMP-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomUUID().slice(0, 8).toUpperCase();
  const [created] = await db.insert(campaigns).values({
    id, campaignNumber, customerId: input.customerId, partnerUserId: input.partnerUserId ?? null, name: input.name.trim(),
    status: "draft", currencyCode: input.currencyCode, grossAmount: input.grossAmount, plannedAdSpend: input.plannedAdSpend,
    managementFeeAmount: input.managementFeeAmount, partnerSharePercent: input.partnerSharePercent,
    startsOn: input.startsOn ?? null, endsOn: input.endsOn ?? null, notes: input.notes?.trim() || null, createdBy: context.actorId
  }).returning();
  if (!created) throw new ApplicationError("CAMPAIGN_CREATE_FAILED", 500, "تعذر إنشاء الحملة");
  await recordAuditEvent(db, { actorId: context.actorId, action: "campaign.created", resourceType: "campaign", resourceId: id, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { campaignNumber, customerId: input.customerId, partnerUserId: input.partnerUserId ?? null } });
  return getCampaign(db, id, context.actorId, true);
}

export async function getCampaign(db: Database, campaignId: string, actorId: string, privileged: boolean) {
  const row = await assertCampaignAccess(db, campaignId, actorId, privileged) ?? await getCampaignRow(db, campaignId);
  const spend = await db.execute(sql`
    SELECT cse.*, (csr.id IS NOT NULL) AS reversed
    FROM campaign_spend_entries cse
    LEFT JOIN campaign_spend_reversals csr ON csr.spend_id = cse.id
    WHERE cse.campaign_id = ${campaignId}::uuid
    ORDER BY cse.spent_at ASC
  `);
  const invoicesLinked = await db.select().from(campaignInvoices).where(eq(campaignInvoices.campaignId, campaignId)).orderBy(asc(campaignInvoices.createdAt));
  const spendRows = spend.rows as Array<{ amount: string; reversed: boolean }>;
  const spendTotal = spendRows.reduce((sum, item) => item.reversed ? sum : sum.add(new Decimal(item.amount)), new Decimal(0));
  const estimatedProfit = new Decimal(row.grossAmount).sub(spendTotal);
  const estimatedPartnerShare = estimatedProfit.mul(new Decimal(row.partnerSharePercent)).div(100);
  return { campaign: row, spend: spend.rows, invoices: invoicesLinked, financialSnapshot: { spendTotal: spendTotal.toFixed(), estimatedProfit: estimatedProfit.toFixed(), estimatedPartnerShare: estimatedPartnerShare.toFixed() } };
}

export async function listCampaigns(db: Database, actorId: string, privileged: boolean, partnerUserId?: string, pagination: Pagination) {
  const conditions = [];
  if (!privileged) conditions.push(eq(campaigns.partnerUserId, actorId));
  else if (partnerUserId) conditions.push(eq(campaigns.partnerUserId, partnerUserId));
  const rows = await db.select().from(campaigns).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(campaigns.createdAt)).limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}

export async function transitionCampaign(db: Database, campaignId: string, input: z.infer<typeof campaignStatusInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }, privileged: boolean) {
  const rows = await db.execute(sql`SELECT id, status, partner_user_id FROM campaigns WHERE id = ${campaignId}::uuid FOR UPDATE`);
  const row = rows.rows[0] as { id: string; status: string; partner_user_id: string | null } | undefined;
  if (!row) throw new ApplicationError("CAMPAIGN_NOT_FOUND", 404, "الحملة غير موجودة");
  if (!privileged && row.partner_user_id !== context.actorId) throw new ApplicationError("CAMPAIGN_ACCESS_DENIED", 403, "الحملة ليست ضمن نطاقك");
  if (!(transitionMap[row.status] ?? []).includes(input.status)) throw new ApplicationError("CAMPAIGN_INVALID_TRANSITION", 409, "انتقال الحملة غير مسموح به");
  const [updated] = await db.update(campaigns).set({ status: input.status, updatedAt: new Date() }).where(eq(campaigns.id, campaignId)).returning();
  if (!updated) throw new ApplicationError("CAMPAIGN_UPDATE_FAILED", 500, "تعذر تحديث الحملة");
  await recordAuditEvent(db, { actorId: context.actorId, action: "campaign.status_changed", resourceType: "campaign", resourceId: campaignId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { from: row.status, to: input.status } });
  return getCampaign(db, campaignId, context.actorId, privileged);
}

export async function linkCampaignInvoice(db: Database, campaignId: string, input: z.infer<typeof linkCampaignInvoiceInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }, privileged: boolean) {
  await assertCampaignAccess(db, campaignId, context.actorId, privileged);
  const invoiceRows = await db.execute(sql`SELECT id, customer_id, status FROM invoices WHERE id = ${input.invoiceId}::uuid`);
  const invoice = invoiceRows.rows[0] as { id: string; customer_id: string; status: string } | undefined;
  const campaign = await getCampaignRow(db, campaignId);
  if (!invoice) throw new ApplicationError("INVOICE_NOT_FOUND", 404, "الفاتورة غير موجودة");
  if (invoice.status !== "issued") throw new ApplicationError("INVOICE_NOT_ISSUED", 409, "لا يمكن ربط فاتورة غير صادرة");
  if (invoice.customer_id !== campaign.customerId) throw new ApplicationError("CUSTOMER_MISMATCH", 409, "الفاتورة لا تخص عميل الحملة");
  const [linked] = await db.insert(campaignInvoices).values({ id: randomUUID(), campaignId, invoiceId: input.invoiceId }).returning();
  if (!linked) throw new ApplicationError("CAMPAIGN_INVOICE_LINK_FAILED", 500, "تعذر ربط الفاتورة بالحملة");
  await recordAuditEvent(db, { actorId: context.actorId, action: "campaign.invoice_linked", resourceType: "campaign", resourceId: campaignId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { invoiceId: input.invoiceId } });
  return getCampaign(db, campaignId, context.actorId, privileged);
}

export async function recordCampaignSpend(db: Database, campaignId: string, input: z.infer<typeof recordCampaignSpendInputSchema>, context: { actorId: string; requestId: string; idempotencyKey: string }, privileged: boolean) {
  const campaign = await assertCampaignAccess(db, campaignId, context.actorId, privileged) ?? await getCampaignRow(db, campaignId);
  if (!["planned", "active", "paused"].includes(campaign.status)) throw new ApplicationError("CAMPAIGN_INVALID_STATE", 409, "لا يمكن تسجيل الإنفاق في حالة الحملة الحالية");
  if (campaign.currencyCode !== input.currencyCode) throw new ApplicationError("CURRENCY_MISMATCH", 409, "عملة الإنفاق يجب أن تطابق عملة الحملة");
  const [entry] = await db.insert(campaignSpendEntries).values({ id: randomUUID(), campaignId, amount: input.amount, currencyCode: input.currencyCode, spentAt: input.spentAt ? new Date(input.spentAt) : new Date(), reference: input.reference?.trim() || null, notes: input.notes?.trim() || null, recordedBy: context.actorId }).returning();
  if (!entry) throw new ApplicationError("CAMPAIGN_SPEND_CREATE_FAILED", 500, "تعذر تسجيل الإنفاق");
  await postCampaignSpendRecorded(db, entry.id, context);
  await recordAuditEvent(db, { actorId: context.actorId, action: "campaign.spend_recorded", resourceType: "campaign", resourceId: campaignId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { amount: input.amount, currencyCode: input.currencyCode, spendId: entry.id } });
  return getCampaign(db, campaignId, context.actorId, privileged);
}


export const reverseCampaignSpendInputSchema = z.object({
  reason: z.string().trim().min(1).max(1000)
});

export async function reverseCampaignSpendEntry(
  db: Database,
  campaignId: string,
  spendId: string,
  input: z.infer<typeof reverseCampaignSpendInputSchema>,
  context: { actorId: string; requestId: string; idempotencyKey: string },
  privileged: boolean
) {
  const campaign = await assertCampaignAccess(db, campaignId, context.actorId, privileged) ?? await getCampaignRow(db, campaignId);
  const rows = await db.execute(sql`SELECT id, campaign_id FROM campaign_spend_entries WHERE id = ${spendId}::uuid FOR UPDATE`);
  const spend = rows.rows[0] as { id: string; campaign_id: string } | undefined;
  if (!spend || spend.campaign_id !== campaign.id) throw new ApplicationError("CAMPAIGN_SPEND_NOT_FOUND", 404, "سجل الإنفاق غير موجود");
  const existing = await db.select({ id: campaignSpendReversals.id }).from(campaignSpendReversals).where(eq(campaignSpendReversals.spendId, spendId)).limit(1);
  if (existing[0]) throw new ApplicationError("CAMPAIGN_SPEND_ALREADY_REVERSED", 409, "تم عكس سجل الإنفاق مسبقاً");
  const reversalId = randomUUID();
  const [reversal] = await db.insert(campaignSpendReversals).values({
    id: reversalId, spendId, reason: input.reason.trim(), reversedBy: context.actorId
  }).returning();
  if (!reversal) throw new ApplicationError("CAMPAIGN_SPEND_REVERSAL_FAILED", 500, "تعذر إنشاء عكس الإنفاق");
  await reverseCampaignSpend(db, spendId, context);
  await recordAuditEvent(db, { actorId: context.actorId, action: "campaign.spend_reversed", resourceType: "campaign", resourceId: campaignId, requestId: context.requestId, idempotencyKey: context.idempotencyKey, metadata: { spendId, reversalId, reason: input.reason.trim() } });
  return getCampaign(db, campaignId, context.actorId, privileged);
}
