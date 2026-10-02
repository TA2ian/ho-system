import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { ApplicationError } from "../../domain/errors.js";
import { recordAuditEvent } from "../audit.js";

const rate=z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>new Decimal(v).gt(0),"سعر الصرف يجب أن يكون أكبر من صفر");
export const setExchangeRateInputSchema=z.object({
  baseCurrencyCode:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  quoteCurrencyCode:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  rate,
  source:z.string().trim().min(1).max(255),
  observedAt:z.string().datetime({offset:true}).optional()
}).refine(v=>v.baseCurrencyCode!==v.quoteCurrencyCode,"لا يمكن أن تكون العملتان متطابقتين");

export async function setExchangeRate(db:Database,input:z.infer<typeof setExchangeRateInputSchema>,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const [row]=await db.execute(sql`INSERT INTO exchange_rates (id,base_currency_code,quote_currency_code,rate,source,observed_at) VALUES (${randomUUID()}::uuid,${input.baseCurrencyCode},${input.quoteCurrencyCode},${input.rate},${input.source.trim()},${input.observedAt?new Date(input.observedAt):new Date()}) RETURNING *`);
  if(!row)throw new ApplicationError("EXCHANGE_RATE_CREATE_FAILED",500,"تعذر تسجيل سعر الصرف");
  await recordAuditEvent(db,{actorId:context.actorId,action:"exchange_rate.recorded",resourceType:"exchange_rate",resourceId:String((row as {id:string}).id),requestId:context.requestId,idempotencyKey:context.idempotencyKey,metadata:{baseCurrencyCode:input.baseCurrencyCode,quoteCurrencyCode:input.quoteCurrencyCode,rate:input.rate,source:input.source}});
  return row;
}
export async function getLatestExchangeRate(db:Database,base:string,quote:string){
  if(base===quote)return {baseCurrencyCode:base,quoteCurrencyCode:quote,rate:"1",source:"identity",observedAt:null};
  const rows=await db.execute(sql`SELECT base_currency_code,quote_currency_code,rate::text AS rate,source,observed_at FROM exchange_rates WHERE base_currency_code=${base} AND quote_currency_code=${quote} ORDER BY observed_at DESC,created_at DESC LIMIT 1`);
  const row=rows.rows[0] as {base_currency_code:string;quote_currency_code:string;rate:string;source:string;observed_at:Date}|undefined;
  if(!row)throw new ApplicationError("EXCHANGE_RATE_NOT_FOUND",404,"سعر الصرف غير متوفر");
  return {baseCurrencyCode:row.base_currency_code,quoteCurrencyCode:row.quote_currency_code,rate:row.rate,source:row.source,observedAt:row.observed_at};
}
export async function resolveRateToBase(db:Database,transactionCurrency:string,baseCurrency="USD"){
  if(transactionCurrency===baseCurrency)return "1";
  const direct=await db.execute(sql`SELECT rate::text AS rate FROM exchange_rates WHERE base_currency_code=${baseCurrency} AND quote_currency_code=${transactionCurrency} ORDER BY observed_at DESC,created_at DESC LIMIT 1`);
  const d=direct.rows[0] as {rate:string}|undefined;
  if(d)return new Decimal(1).div(d.rate).toFixed(10);
  const inverse=await db.execute(sql`SELECT rate::text AS rate FROM exchange_rates WHERE base_currency_code=${transactionCurrency} AND quote_currency_code=${baseCurrency} ORDER BY observed_at DESC,created_at DESC LIMIT 1`);
  const i=inverse.rows[0] as {rate:string}|undefined;
  if(i)return new Decimal(i.rate).toFixed(10);
  throw new ApplicationError("EXCHANGE_RATE_NOT_FOUND",404,"سعر الصرف المطلوب للتحويل إلى عملة الأساس غير متوفر");
}
