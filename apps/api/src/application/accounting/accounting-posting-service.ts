import { and, eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import type { Database } from "../../db/client.js";
import { invoices } from "../../db/invoice-schema.js";
import { createJournal, postJournal } from "./accounting-service.js";
import { resolveRateToBase } from "../exchange/exchange-service.js";

async function accountIds(db:Database,codes:string[]){
  const result=await db.execute(sql`SELECT code,id FROM chart_of_accounts WHERE code = ANY(${codes}::text[])`);
  const map=new Map<string,string>();
  for(const row of result.rows as Array<{code:string;id:string}>)map.set(row.code,row.id);
  for(const code of codes)if(!map.has(code))throw new Error("Missing chart account "+code);
  return map;
}

export async function postInvoiceIssued(db:Database,invoiceId:string,context:{actorId:string;requestId:string;idempotencyKey:string}){
  const invoiceResult=await db.execute(sql`SELECT id,customer_id,total_amount,currency_code,issue_date,journal_entry_id FROM invoices WHERE id=${invoiceId}::uuid FOR UPDATE`);
  const invoice=invoiceResult.rows[0] as {id:string;customer_id:string;total_amount:string;currency_code:string;issue_date:string|null;journal_entry_id:string|null}|undefined;
  if(!invoice)throw new Error("Invoice not found");
  if(invoice.journal_entry_id)return invoice.journal_entry_id;
  if(!invoice.issue_date)throw new Error("Invoice issue date missing");
  const linesResult=await db.execute(sql`
    SELECT il.line_total::text AS line_total,sol.quantity::text AS quantity,sol.unit_cost::text AS unit_cost,ci.item_kind
    FROM invoice_lines il
    JOIN sales_order_lines sol ON sol.id=il.sales_order_line_id
    JOIN catalog_items ci ON ci.id=sol.catalog_item_id
    WHERE il.invoice_id=${invoiceId}::uuid
    ORDER BY il.line_number
  `);
  const campaignResult=await db.execute(sql`SELECT 1 FROM campaign_invoices WHERE invoice_id=${invoiceId}::uuid LIMIT 1`);
  const campaignInvoice=Boolean(campaignResult.rows[0]);
  const revenue=new Map<string,Decimal>();
  let cogs=new Decimal(0);
  for(const row of linesResult.rows as Array<{line_total:string;quantity:string;unit_cost:string;item_kind:string}>){
    const kind=row.item_kind.toLowerCase();
    const revenueCode=campaignInvoice?"4200":(["product","material"].includes(kind)?"4000":"4100");
    revenue.set(revenueCode,(revenue.get(revenueCode)??new Decimal(0)).add(new Decimal(row.line_total)));
    if(["product","material"].includes(kind))cogs=cogs.add(new Decimal(row.quantity).mul(new Decimal(row.unit_cost)));
  }
  const codes=["1100",...revenue.keys(),...(cogs.gt(0)?["5000","1200"]:[])];
  const accounts=await accountIds(db,codes);
  const rate=await resolveRateToBase(db,invoice.currency_code,"USD");
  const lines=[{accountId:accounts.get("1100")!,debitAmount:invoice.total_amount,description:"Accounts receivable",customerId:invoice.customer_id}];
  let n=2;
  for(const [code,value] of revenue)lines.push({accountId:accounts.get(code)!,creditAmount:value.toFixed(),description:"Revenue",customerId:null});
  if(cogs.gt(0)){lines.push({accountId:accounts.get("5000")!,debitAmount:cogs.toFixed(),description:"Cost of goods sold",customerId:null});lines.push({accountId:accounts.get("1200")!,creditAmount:cogs.toFixed(),description:"Inventory reduction",customerId:null});}
  const created=await createJournal(db,{entryDate:invoice.issue_date,currencyCode:invoice.currency_code,exchangeRateToBase:rate,description:"Invoice "+invoiceId,sourceType:"invoice",sourceId:invoiceId,sourceEventKey:"invoice:"+invoiceId+":issued",lines},context);
  const posted=await postJournal(db,created.entry.id,context);
  await db.update(invoices).set({journalEntryId:posted.entry.id}).where(eq(invoices.id,invoiceId));
  return posted.entry.id;
}
