import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { employeeCompensationRules, employeeTasks } from "../../db/employee-schema.js";
import { roles, userRoles, users } from "../../db/schema.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";
import { postEmployeeCompensation } from "../accounting/accounting-posting-service.js";

const uuid=z.string().uuid();
const amount=z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>new Decimal(v).gte(0),"المبلغ غير صالح");
const positiveAmount=z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>new Decimal(v).gt(0),"المبلغ يجب أن يكون أكبر من صفر");
const saleType=z.string().trim().min(1).max(100);

async function assertActiveEmployee(db:Database,userId:string){
  const rows=await db.select({id:users.id}).from(users).innerJoin(userRoles,eq(userRoles.userId,users.id)).innerJoin(roles,eq(roles.id,userRoles.roleId))
    .where(and(eq(users.id,userId),eq(users.status,"active"),sql`roles.code IN ('employee','driver','sales','operations')`)).limit(1);
  if(!rows[0])throw new ApplicationError("EMPLOYEE_NOT_FOUND",404,"الموظف غير موجود أو غير فعال");
}

export const createCompensationRuleInputSchema=z.object({
  employeeUserId:uuid,saleType:saleType.nullable().optional(),
  method:z.enum(["percentage","fixed_per_task","fixed_per_sale","fixed_salary"]),
  ratePercent:z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  fixedAmount:amount.nullable().optional(),currencyCode:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable().optional(),
  notes:z.string().trim().max(2000).nullable().optional()
}).superRefine((v,ctx)=>{
  const method=v.method;
  if(method==="percentage" && (!v.saleType || !v.ratePercent || v.fixedAmount || v.currencyCode))ctx.addIssue({code:z.ZodIssueCode.custom,path:["method"],message:"قاعدة النسبة تتطلب نوع بيع ونسبة فقط"});
  if((method==="fixed_per_task"||method==="fixed_per_sale") && (!v.saleType || !v.fixedAmount || v.ratePercent || v.currencyCode))ctx.addIssue({code:z.ZodIssueCode.custom,path:["method"],message:"القاعدة الثابتة تتطلب نوع بيع ومبلغاً ثابتاً"});
  if(method==="fixed_salary" && (v.saleType || !v.fixedAmount || v.ratePercent || !v.currencyCode))ctx.addIssue({code:z.ZodIssueCode.custom,path:["method"],message:"الراتب الثابت يتطلب مبلغاً وعملة ولا يرتبط بنوع بيع"});
  if(v.ratePercent && new Decimal(v.ratePercent).gt(100))ctx.addIssue({code:z.ZodIssueCode.custom,path:["ratePercent"],message:"النسبة لا تتجاوز 100"});
});

export const createEmployeeTaskInputSchema=z.object({
  employeeUserId:uuid,taskType:z.string().trim().min(1).max(100),saleType:saleType.nullable().optional(),
  sourceSalesOrderId:uuid.nullable().optional(),basisAmount:amount,currencyCode:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),notes:z.string().trim().max(2000).nullable().optional()
});

export async function createCompensationRule(db:Database,input:z.infer<typeof createCompensationRuleInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  await assertActiveEmployee(db,input.employeeUserId);
  const [row]=await db.insert(employeeCompensationRules).values({
    id:randomUUID(),employeeUserId:input.employeeUserId,saleType:input.saleType?.trim()||null,method:input.method,
    ratePercent:input.ratePercent??null,fixedAmount:input.fixedAmount??null,currencyCode:input.currencyCode??null,
    notes:input.notes?.trim()||null,createdBy:context.actorId
  }).returning();
  if(!row)throw new ApplicationError("COMPENSATION_RULE_CREATE_FAILED",500,"تعذر إنشاء قاعدة التعويض");
  await recordAuditEvent(db,{actorId:context.actorId,action:"compensation.rule_created",resourceType:"compensation_rule",resourceId:row.id,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{employeeUserId:input.employeeUserId,saleType:input.saleType??null,method:input.method}});
  return row;
}

export async function listCompensationRules(db:Database,employeeUserId?:string){
  const where=employeeUserId?eq(employeeCompensationRules.employeeUserId,employeeUserId):undefined;
  return db.select().from(employeeCompensationRules).where(where).orderBy(asc(employeeCompensationRules.createdAt));
}

export async function createEmployeeTask(db:Database,input:z.infer<typeof createEmployeeTaskInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  await assertActiveEmployee(db,input.employeeUserId);
  const [row]=await db.insert(employeeTasks).values({id:randomUUID(),employeeUserId:input.employeeUserId,taskType:input.taskType.trim(),saleType:input.saleType?.trim()||null,sourceSalesOrderId:input.sourceSalesOrderId??null,basisAmount:input.basisAmount,currencyCode:input.currencyCode,status:"assigned",notes:input.notes?.trim()||null,createdBy:context.actorId}).returning();
  if(!row)throw new ApplicationError("TASK_CREATE_FAILED",500,"تعذر إنشاء المهمة");
  await recordAuditEvent(db,{actorId:context.actorId,action:"employee_task.created",resourceType:"employee_task",resourceId:row.id,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{employeeUserId:input.employeeUserId,saleType:input.saleType??null}});
  return row;
}

export async function listEmployeeTasks(db:Database,actorId:string,privileged:boolean,employeeUserId?:string){
  if(!privileged) employeeUserId=actorId;
  if(employeeUserId)await assertActiveEmployee(db,employeeUserId);
  return db.select().from(employeeTasks).where(employeeUserId?eq(employeeTasks.employeeUserId,employeeUserId):undefined).orderBy(asc(employeeTasks.createdAt));
}

export async function completeEmployeeTask(db:Database,taskId:string,context:{actorId:string;requestId:string;idempotencyKey:string},privileged:boolean){
  const result=await db.execute(sql`SELECT id,employee_user_id,status,sale_type,basis_amount,currency_code FROM employee_tasks WHERE id=${taskId}::uuid FOR UPDATE`);
  const task=result.rows[0] as {id:string;employee_user_id:string;status:string;sale_type:string|null;basis_amount:string;currency_code:string}|undefined;
  if(!task)throw new ApplicationError("TASK_NOT_FOUND",404,"المهمة غير موجودة");
  if(!privileged&&task.employee_user_id!==context.actorId)throw new ApplicationError("TASK_ACCESS_DENIED",403,"المهمة ليست ضمن نطاقك");
  if(task.status!=="assigned")throw new ApplicationError("TASK_INVALID_STATE",409,"المهمة ليست قيد التنفيذ");
  if(!task.sale_type)throw new ApplicationError("TASK_COMPENSATION_RULE_MISSING",409,"المهمة لا تحتوي نوع بيع لحساب التعويض");
  const rules=await db.select().from(employeeCompensationRules).where(and(eq(employeeCompensationRules.employeeUserId,task.employee_user_id),eq(employeeCompensationRules.saleType,task.sale_type),eq(employeeCompensationRules.isActive,true))).limit(1);
  const rule=rules[0];
  if(!rule)throw new ApplicationError("COMPENSATION_RULE_MISSING",409,"لا توجد قاعدة تعويض فعالة لهذا الموظف ونوع البيع");
  const basis=new Decimal(task.basis_amount);
  let compensation=new Decimal(0);
  if(rule.method==="percentage")compensation=basis.mul(new Decimal(rule.ratePercent ?? "0")).div(100);
  else if(rule.method==="fixed_per_task"||rule.method==="fixed_per_sale")compensation=new Decimal(rule.fixedAmount ?? "0");
  else throw new ApplicationError("COMPENSATION_RULE_INVALID",409,"قاعدة الراتب الثابت لا تستخدم لإتمام مهمة");
  if(rule.currencyCode&&rule.currencyCode!==task.currency_code)throw new ApplicationError("CURRENCY_MISMATCH",409,"عملة التعويض لا تطابق عملة المهمة");
  const now=new Date();
  const [updated]=await db.update(employeeTasks).set({status:"completed",completedAt:now,compensationRuleId:rule.id,compensationAmount:compensation.toFixed(),updatedAt:now}).where(eq(employeeTasks.id,taskId)).returning();
  if(!updated)throw new ApplicationError("TASK_UPDATE_FAILED",500,"تعذر إتمام المهمة");
  await postEmployeeCompensation(db, taskId, context);
  await recordAuditEvent(db,{actorId:context.actorId,action:"employee_task.completed",resourceType:"employee_task",resourceId:taskId,requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{ruleId:rule.id,compensationAmount:compensation.toFixed()}});
  return updated;
}
