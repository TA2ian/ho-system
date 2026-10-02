import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { accountingPeriods, chartOfAccounts, journalEntries, journalLines } from "../../db/accounting-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";

const uuid=z.string().uuid();
const money=z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>new Decimal(v).gt(0),"المبلغ يجب أن يكون أكبر من صفر");

export const createPeriodInputSchema=z.object({periodStart:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),periodEnd:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).refine(v=>v.periodEnd>=v.periodStart,"نطاق الفترة غير صالح");
export const createAccountInputSchema=z.object({code:z.string().trim().min(1).max(50),name:z.string().trim().min(1).max(255),accountType:z.enum(["asset","liability","equity","revenue","expense"]),normalBalance:z.enum(["debit","credit"]),parentId:uuid.nullable().optional()});
export const journalLineInputSchema=z.object({accountId:uuid,debitAmount:money.nullable().optional(),creditAmount:money.nullable().optional(),description:z.string().trim().max(500).nullable().optional(),customerId:uuid.nullable().optional()});
export const createJournalInputSchema=z.object({entryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),currencyCode:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),exchangeRateToBase:money,description:z.string().trim().min(1).max(2000),sourceType:z.string().trim().max(100).nullable().optional(),sourceId:z.string().trim().max(255).nullable().optional(),sourceEventKey:z.string().trim().max(255).nullable().optional(),lines:z.array(journalLineInputSchema).min(2)});
export const createReversalInputSchema=z.object({entryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),reason:z.string().trim().min(3).max(500)});

function assertBalanced(lines:z.infer<typeof journalLineInputSchema>[],rate:string){
  let debit=new Decimal(0),credit=new Decimal(0);
  for(const line of lines){const d=new Decimal(line.debitAmount??"0"),c=new Decimal(line.creditAmount??"0");if(d.gt(0)&&c.gt(0))throw new ApplicationError("JOURNAL_LINE_INVALID",400,"السطر لا يمكن أن يكون مديناً ودائناً معاً");if(!d.gt(0)&&!c.gt(0))throw new ApplicationError("JOURNAL_LINE_INVALID",400,"كل سطر يجب أن يحتوي مديناً أو دائناً");debit=debit.add(d);credit=credit.add(c);}
  if(!debit.eq(credit))throw new ApplicationError("JOURNAL_UNBALANCED",409,"إجمالي المدين يجب أن يساوي إجمالي الدائن");
  const baseDebit=debit.mul(new Decimal(rate)),baseCredit=credit.mul(new Decimal(rate));if(!baseDebit.eq(baseCredit))throw new ApplicationError("JOURNAL_BASE_UNBALANCED",409,"القيد غير متوازن بعملة الأساس");
}

async function openPeriod(db:Database,entryDate:string){
  const rows=await db.select().from(accountingPeriods).where(and(eq(accountingPeriods.status,"open"),lte(accountingPeriods.periodStart,entryDate),gte(accountingPeriods.periodEnd,entryDate))).limit(1);
  if(!rows[0])throw new ApplicationError("ACCOUNTING_PERIOD_CLOSED",409,"لا توجد فترة محاسبية مفتوحة لهذا التاريخ");
  return rows[0];
}

export async function createPeriod(db:Database,input:z.infer<typeof createPeriodInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const [row]=await db.insert(accountingPeriods).values({id:randomUUID(),periodStart:input.periodStart,periodEnd:input.periodEnd,status:"open",createdBy:context.actorId}).returning();
  if(!row)throw new ApplicationError("PERIOD_CREATE_FAILED",500,"تعذر إنشاء الفترة");
  await recordAuditEvent(db,{actorId:context.actorId,action:"accounting.period_created",resourceType:"accounting_period",resourceId:row.id,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{periodStart:input.periodStart,periodEnd:input.periodEnd}});
  return row;
}
export async function closePeriod(db:Database,periodId:string,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const rows=await db.execute(sql`SELECT id,status FROM accounting_periods WHERE id=${periodId}::uuid FOR UPDATE`);
  const row=rows.rows[0] as {id:string;status:string}|undefined;if(!row)throw new ApplicationError("PERIOD_NOT_FOUND",404,"الفترة غير موجودة");if(row.status!=="open")throw new ApplicationError("PERIOD_ALREADY_CLOSED",409,"الفترة مغلقة بالفعل");
  const [updated]=await db.update(accountingPeriods).set({status:"closed",closedAt:new Date(),closedBy:context.actorId}).where(eq(accountingPeriods.id,periodId)).returning();
  if(!updated)throw new ApplicationError("PERIOD_CLOSE_FAILED",500,"تعذر إغلاق الفترة");
  await recordAuditEvent(db,{actorId:context.actorId,action:"accounting.period_closed",resourceType:"accounting_period",resourceId:periodId,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{}});
  return updated;
}
export async function listPeriods(db:Database){return db.select().from(accountingPeriods).orderBy(asc(accountingPeriods.periodStart));}
export async function createAccount(db:Database,input:z.infer<typeof createAccountInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const [row]=await db.insert(chartOfAccounts).values({id:randomUUID(),code:input.code.trim(),name:input.name.trim(),accountType:input.accountType,normalBalance:input.normalBalance,parentId:input.parentId??null}).returning();
  if(!row)throw new ApplicationError("ACCOUNT_CREATE_FAILED",500,"تعذر إنشاء الحساب");
  await recordAuditEvent(db,{actorId:context.actorId,action:"accounting.account_created",resourceType:"chart_of_account",resourceId:row.id,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{code:row.code}});
  return row;
}
export async function listAccounts(db:Database){return db.select().from(chartOfAccounts).where(eq(chartOfAccounts.isActive,true)).orderBy(asc(chartOfAccounts.code));}

export async function createJournal(db:Database,input:z.infer<typeof createJournalInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  assertBalanced(input.lines,input.exchangeRateToBase);
  const period=await openPeriod(db,input.entryDate);
  const entryId=randomUUID(),entryNumber="JE-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+randomUUID().slice(0,8).toUpperCase();
  const [entry]=await db.insert(journalEntries).values({id:entryId,entryNumber,status:"draft",entryDate:input.entryDate,accountingPeriodId:period.id,currencyCode:input.currencyCode,exchangeRateToBase:input.exchangeRateToBase,baseCurrencyCode:"USD",description:input.description.trim(),sourceType:input.sourceType?.trim()||null,sourceId:input.sourceId?.trim()||null,sourceEventKey:input.sourceEventKey?.trim()||null,createdBy:context.actorId}).returning();
  if(!entry)throw new ApplicationError("JOURNAL_CREATE_FAILED",500,"تعذر إنشاء القيد");
  for(let i=0;i<input.lines.length;i++){const l=input.lines[i]!;const d=new Decimal(l.debitAmount??"0"),c=new Decimal(l.creditAmount??"0");await db.insert(journalLines).values({id:randomUUID(),journalEntryId:entryId,lineNumber:i+1,accountId:l.accountId,currencyCode:input.currencyCode,debitAmount:d.toFixed(),creditAmount:c.toFixed(),baseDebitAmount:d.mul(new Decimal(input.exchangeRateToBase)).toFixed(),baseCreditAmount:c.mul(new Decimal(input.exchangeRateToBase)).toFixed(),description:l.description?.trim()||null,customerId:l.customerId??null});}
  await recordAuditEvent(db,{actorId:context.actorId,action:"accounting.journal_created",resourceType:"journal_entry",resourceId:entryId,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{entryNumber,sourceType:input.sourceType??null,sourceId:input.sourceId??null}});
  return getJournal(db,entryId);
}
export async function getJournal(db:Database,entryId:string){const [entry]=await db.select().from(journalEntries).where(eq(journalEntries.id,entryId)).limit(1);if(!entry)throw new ApplicationError("JOURNAL_NOT_FOUND",404,"القيد غير موجود");const lines=await db.select().from(journalLines).where(eq(journalLines.journalEntryId,entryId)).orderBy(asc(journalLines.lineNumber));return {entry,lines};}
export async function postJournal(db:Database,entryId:string,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const rows=await db.execute(sql`SELECT id,status,accounting_period_id,entry_date FROM journal_entries WHERE id=${entryId}::uuid FOR UPDATE`);
  const row=rows.rows[0] as {id:string;status:string;accounting_period_id:string;entry_date:string}|undefined;if(!row)throw new ApplicationError("JOURNAL_NOT_FOUND",404,"القيد غير موجود");if(row.status!=="draft")throw new ApplicationError("JOURNAL_INVALID_STATE",409,"القيد ليس مسودة");
  const period=await db.select().from(accountingPeriods).where(eq(accountingPeriods.id,row.accounting_period_id)).limit(1);if(!period[0]||period[0].status!=="open")throw new ApplicationError("ACCOUNTING_PERIOD_CLOSED",409,"الفترة المحاسبية مغلقة");
  const [updated]=await db.update(journalEntries).set({status:"posted",postedBy:context.actorId,postedAt:new Date(),updatedAt:new Date()}).where(eq(journalEntries.id,entryId)).returning();if(!updated)throw new ApplicationError("JOURNAL_POST_FAILED",500,"تعذر ترحيل القيد");
  await recordAuditEvent(db,{actorId:context.actorId,action:"accounting.journal_posted",resourceType:"journal_entry",resourceId:entryId,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{entryDate:row.entry_date}});
  return getJournal(db,entryId);
}
export async function reverseJournal(db:Database,entryId:string,input:z.infer<typeof createReversalInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const rows=await db.execute(sql`SELECT id,status,entry_date,currency_code,exchange_rate_to_base,description FROM journal_entries WHERE id=${entryId}::uuid FOR UPDATE`);
  const entry=rows.rows[0] as {id:string;status:string;entry_date:string;currency_code:string;exchange_rate_to_base:string;description:string}|undefined;if(!entry)throw new ApplicationError("JOURNAL_NOT_FOUND",404,"القيد غير موجود");if(entry.status!=="posted")throw new ApplicationError("JOURNAL_NOT_POSTED",409,"لا يمكن عكس قيد غير مرحل");
  const existing=await db.select({id:journalEntries.id}).from(journalEntries).where(eq(journalEntries.reversesEntryId,entryId)).limit(1);if(existing[0])throw new ApplicationError("JOURNAL_ALREADY_REVERSED",409,"القيد معكوس بالفعل");
  const period=await openPeriod(db,input.entryDate);
  const lines=await db.select().from(journalLines).where(eq(journalLines.journalEntryId,entryId)).orderBy(asc(journalLines.lineNumber));
  const reversalId=randomUUID(),entryNumber="JE-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+randomUUID().slice(0,8).toUpperCase();
  const [created]=await db.insert(journalEntries).values({id:reversalId,entryNumber,status:"draft",entryDate:input.entryDate,accountingPeriodId:period.id,currencyCode:entry.currency_code,exchangeRateToBase:entry.exchange_rate_to_base,baseCurrencyCode:"USD",description:"Reversal: "+entry.description+" — "+input.reason,sourceType:"journal_reversal",sourceId:entryId,sourceEventKey:"reversal:"+entryId,reversesEntryId:entryId,createdBy:context.actorId}).returning();
  if(!created)throw new ApplicationError("REVERSAL_CREATE_FAILED",500,"تعذر إنشاء قيد العكس");
  for(const line of lines){await db.insert(journalLines).values({id:randomUUID(),journalEntryId:reversalId,lineNumber:line.lineNumber,accountId:line.accountId,currencyCode:line.currencyCode,debitAmount:line.creditAmount,creditAmount:line.debitAmount,baseDebitAmount:line.baseCreditAmount,baseCreditAmount:line.baseDebitAmount,description:"Reversal",customerId:line.customerId});}
  return postJournal(db,reversalId,context);
}
