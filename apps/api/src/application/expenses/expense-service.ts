import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { expenses } from "../../db/expense-schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { pageRows, type Pagination } from "../pagination.js";
import { recordAuditEvent } from "../audit.js";
import { postExpenseRecorded, postExpenseVoided } from "../accounting/accounting-posting-service.js";

const amount=z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>new Decimal(v).gt(0),"المبلغ يجب أن يكون أكبر من صفر");
export const createExpenseInputSchema=z.object({
  category:z.string().trim().min(1).max(100),
  vendorName:z.string().trim().max(255).nullable().optional(),
  description:z.string().trim().min(1).max(2000),
  amount,
  currencyCode:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  paymentMethod:z.enum(["cash","sham_cash","unpaid"]),
  incurredAt:z.string().datetime({offset:true}).optional(),
  reference:z.string().trim().max(255).nullable().optional(),
  notes:z.string().trim().max(2000).nullable().optional()
});

export const voidExpenseInputSchema=z.object({reason:z.string().trim().min(3).max(500)});
export async function createExpense(db:Database,input:z.infer<typeof createExpenseInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const now=input.incurredAt?new Date(input.incurredAt):new Date();
  const paid=input.paymentMethod==="unpaid"?null:now;
  const [row]=await db.insert(expenses).values({id:randomUUID(),expenseNumber:"EXP-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+randomUUID().slice(0,8).toUpperCase(),category:input.category.trim(),vendorName:input.vendorName?.trim()||null,description:input.description.trim(),amount:input.amount,currencyCode:input.currencyCode,paymentMethod:input.paymentMethod,status:"recorded",incurredAt:now,paidAt:paid,paidBy:paid?context.actorId:null,reference:input.reference?.trim()||null,notes:input.notes?.trim()||null,createdBy:context.actorId}).returning();
  if(!row)throw new ApplicationError("EXPENSE_CREATE_FAILED",500,"تعذر تسجيل المصروف");
  await postExpenseRecorded(db, row.id, context);
  await recordAuditEvent(db,{actorId:context.actorId,action:"expense.recorded",resourceType:"expense",resourceId:row.id,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{amount:input.amount,currencyCode:input.currencyCode,paymentMethod:input.paymentMethod,category:input.category}});
  return row;
}
export async function listExpenses(db:Database, pagination: Pagination){
  const rows=await db.select().from(expenses).where(eq(expenses.status,"recorded"))
    .orderBy(asc(expenses.incurredAt)).limit(pagination.limit + 1).offset(pagination.offset);
  return pageRows(rows, pagination);
}
export async function voidExpense(db:Database,expenseId:string,input:z.infer<typeof voidExpenseInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const [row]=await db.select().from(expenses).where(eq(expenses.id,expenseId)).limit(1);
  if(!row)throw new ApplicationError("EXPENSE_NOT_FOUND",404,"المصروف غير موجود");
  if(row.status!=="recorded")throw new ApplicationError("EXPENSE_ALREADY_VOIDED",409,"المصروف ليس مسجلاً");
  const now=new Date();const [updated]=await db.update(expenses).set({status:"voided",voidedAt:now,updatedAt:now}).where(and(eq(expenses.id,expenseId),eq(expenses.status,"recorded"))).returning();
  if(!updated)throw new ApplicationError("EXPENSE_UPDATE_FAILED",500,"تعذر إلغاء المصروف");
  try { await postExpenseVoided(db, expenseId, context); } catch (error) { throw new ApplicationError("EXPENSE_REVERSAL_FAILED",409,error instanceof Error ? error.message : "تعذر عكس القيد المحاسبي للمصروف"); }
  await recordAuditEvent(db,{actorId:context.actorId,action:"expense.voided",resourceType:"expense",resourceId:expenseId,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{reason:input.reason}});
  return updated;
}
