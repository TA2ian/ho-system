import { eq, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import type { Database } from "../../db/client.js";
import { invoices } from "../../db/invoice-schema.js";
import { paymentAllocations, payments } from "../../db/payment-schema.js";
import { createJournal, postJournal, reverseJournal } from "./accounting-service.js";
import { resolveRateToBase } from "../exchange/exchange-service.js";

type PostingLine = { accountId: string; debitAmount?: string; creditAmount?: string; description: string; customerId?: string | null };

async function accountIds(db:Database,codes:string[]){
  const result=await db.execute(sql`SELECT code,id FROM chart_of_accounts WHERE code = ANY(${codes}::text[])`);
  const map=new Map<string,string>();
  for(const row of result.rows as Array<{code:string;id:string}>)map.set(row.code,row.id);
  for(const code of codes)if(!map.has(code))throw new Error("Missing chart account "+code);
  return map;
}


async function postOperationalJournal(
  db: Database,
  input: {
    entryDate: string;
    currencyCode: string;
    exchangeRateToBase: string;
    description: string;
    sourceType: string;
    sourceId: string;
    sourceEventKey: string;
    lines: PostingLine[];
  },
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const existing = await db.execute(sql`SELECT id FROM journal_entries WHERE source_event_key = ${input.sourceEventKey} LIMIT 1`);
  const existingId = (existing.rows[0] as { id?: string } | undefined)?.id;
  if (existingId) return existingId;
  const created = await createJournal(db, input, context);
  const posted = await postJournal(db, created.entry.id, context);
  return posted.entry.id;
}

export async function reverseSourceJournal(
  db: Database,
  sourceEventKey: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const rows = await db.execute(sql`SELECT id, status FROM journal_entries WHERE source_event_key = ${sourceEventKey} LIMIT 1 FOR UPDATE`);
  const entry = rows.rows[0] as { id: string; status: string } | undefined;
  if (!entry) throw new Error("Missing accounting journal for " + sourceEventKey);
  if (entry.status !== "posted") throw new Error("Accounting journal is not posted for " + sourceEventKey);
  const existingReversal = await db.execute(sql`SELECT id FROM journal_entries WHERE reverses_entry_id = ${entry.id}::uuid LIMIT 1`);
  if (existingReversal.rows[0]) return String((existingReversal.rows[0] as { id: string }).id);

  const openOriginalPeriod = await db.execute(sql`
    SELECT 1
    FROM accounting_periods
    WHERE status = 'open'
      AND period_start <= (SELECT entry_date FROM journal_entries WHERE id = ${entry.id}::uuid)
      AND period_end >= (SELECT entry_date FROM journal_entries WHERE id = ${entry.id}::uuid)
    LIMIT 1
  `);
  const reversalDate = openOriginalPeriod.rows[0]
    ? String((await db.execute(sql`SELECT entry_date FROM journal_entries WHERE id = ${entry.id}::uuid`)).rows[0]?.entry_date)
    : new Date().toISOString().slice(0, 10);

  return (await reverseJournal(db, entry.id, {
    entryDate: reversalDate,
    reason: "Operational reversal",
  }, context)).entry.id;
}

export async function postPaymentRecorded(
  db: Database,
  paymentId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const rows = await db.execute(sql`
    SELECT id, customer_id, amount, currency_code, method, received_at
    FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE
  `);
  const payment = rows.rows[0] as {
    id: string; customer_id: string; amount: string; currency_code: string; method: string; received_at: Date;
  } | undefined;
  if (!payment) throw new Error("Payment not found");
  const cashCode = payment.method === "sham_cash" ? "1010" : "1000";
  const accounts = await accountIds(db, [cashCode, "2300"]);
  const rate = await resolveRateToBase(db, payment.currency_code, "USD");
  return postOperationalJournal(db, {
    entryDate: payment.received_at.toISOString().slice(0, 10),
    currencyCode: payment.currency_code,
    exchangeRateToBase: rate,
    description: "Customer payment " + paymentId,
    sourceType: "payment",
    sourceId: paymentId,
    sourceEventKey: "payment:" + paymentId + ":recorded",
    lines: [
      { accountId: accounts.get(cashCode)!, debitAmount: payment.amount, description: "Cash receipt", customerId: payment.customer_id },
      { accountId: accounts.get("2300")!, creditAmount: payment.amount, description: "Unapplied customer receipt", customerId: payment.customer_id }
    ]
  }, context);
}

export async function postPaymentAllocated(
  db: Database,
  allocationId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const rows = await db.execute(sql`
    SELECT pa.id, pa.payment_id, pa.invoice_id, pa.amount, pa.currency_code, p.customer_id, p.received_at
    FROM payment_allocations pa
    JOIN payments p ON p.id = pa.payment_id
    WHERE pa.id = ${allocationId}::uuid
    FOR UPDATE
  `);
  const allocation = rows.rows[0] as {
    id: string; payment_id: string; invoice_id: string; amount: string; currency_code: string; customer_id: string; received_at: Date;
  } | undefined;
  if (!allocation) throw new Error("Payment allocation not found");
  const accounts = await accountIds(db, ["1100", "2300"]);
  const rate = await resolveRateToBase(db, allocation.currency_code, "USD");
  return postOperationalJournal(db, {
    entryDate: allocation.received_at.toISOString().slice(0, 10),
    currencyCode: allocation.currency_code,
    exchangeRateToBase: rate,
    description: "Allocate payment " + allocation.id,
    sourceType: "payment_allocation",
    sourceId: allocation.id,
    sourceEventKey: "payment-allocation:" + allocation.id + ":allocated",
    lines: [
      { accountId: accounts.get("2300")!, debitAmount: allocation.amount, description: "Apply customer receipt", customerId: allocation.customer_id },
      { accountId: accounts.get("1100")!, creditAmount: allocation.amount, description: "Reduce accounts receivable", customerId: allocation.customer_id }
    ]
  }, context);
}

export async function reversePaymentAllocation(
  db: Database,
  allocationId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  return reverseSourceJournal(db, "payment-allocation:" + allocationId + ":allocated", context);
}

export async function reversePaymentRecorded(
  db: Database,
  paymentId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  return reverseSourceJournal(db, "payment:" + paymentId + ":recorded", context);
}




export async function postCampaignSpendRecorded(
  db: Database,
  spendId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const rows = await db.execute(sql`
    SELECT cse.id, cse.campaign_id, cse.amount, cse.currency_code, cse.spent_at, c.customer_id
    FROM campaign_spend_entries cse
    JOIN campaigns c ON c.id = cse.campaign_id
    WHERE cse.id = ${spendId}::uuid
    FOR UPDATE
  `);
  const spend = rows.rows[0] as {
    id: string; campaign_id: string; amount: string; currency_code: string; spent_at: Date; customer_id: string;
  } | undefined;
  if (!spend) throw new Error("Campaign spend not found");
  const accounts = await accountIds(db, ["5100", "2000"]);
  const rate = await resolveRateToBase(db, spend.currency_code, "USD");
  return postOperationalJournal(db, {
    entryDate: spend.spent_at.toISOString().slice(0, 10),
    currencyCode: spend.currency_code,
    exchangeRateToBase: rate,
    description: "Advertising spend " + spend.id,
    sourceType: "campaign_spend",
    sourceId: spend.id,
    sourceEventKey: "campaign-spend:" + spend.id + ":recorded",
    lines: [
      { accountId: accounts.get("5100")!, debitAmount: spend.amount, description: "Advertising expense", customerId: spend.customer_id },
      { accountId: accounts.get("2000")!, creditAmount: spend.amount, description: "Advertising payable", customerId: spend.customer_id }
    ]
  }, context);
}

export async function postEmployeeCompensation(
  db: Database,
  taskId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const rows = await db.execute(sql`
    SELECT id, employee_user_id, compensation_amount, currency_code, completed_at
    FROM employee_tasks WHERE id = ${taskId}::uuid FOR UPDATE
  `);
  const task = rows.rows[0] as {
    id: string; employee_user_id: string; compensation_amount: string | null; currency_code: string; completed_at: Date | null;
  } | undefined;
  if (!task || !task.compensation_amount || !task.completed_at) throw new Error("Completed employee compensation not found");
  const accounts = await accountIds(db, ["5200", "2200"]);
  const rate = await resolveRateToBase(db, task.currency_code, "USD");
  return postOperationalJournal(db, {
    entryDate: task.completed_at.toISOString().slice(0, 10),
    currencyCode: task.currency_code,
    exchangeRateToBase: rate,
    description: "Employee compensation " + task.id,
    sourceType: "employee_task",
    sourceId: task.id,
    sourceEventKey: "employee-task:" + task.id + ":completed",
    lines: [
      { accountId: accounts.get("5200")!, debitAmount: task.compensation_amount, description: "Employee compensation expense", customerId: null },
      { accountId: accounts.get("2200")!, creditAmount: task.compensation_amount, description: "Employee compensation payable", customerId: null }
    ]
  }, context);
}

export async function reverseCampaignSpend(
  db: Database,
  spendId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  return reverseSourceJournal(db, "campaign-spend:" + spendId + ":recorded", context);
}

export async function postExpenseRecorded(
  db: Database,
  expenseId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  const rows = await db.execute(sql`
    SELECT id, amount, currency_code, payment_method, incurred_at
    FROM expenses WHERE id = ${expenseId}::uuid FOR UPDATE
  `);
  const expense = rows.rows[0] as {
    id: string; amount: string; currency_code: string; payment_method: string; incurred_at: Date;
  } | undefined;
  if (!expense) throw new Error("Expense not found");
  const creditCode = expense.payment_method === "cash" ? "1000"
    : expense.payment_method === "sham_cash" ? "1010" : "2000";
  const accounts = await accountIds(db, ["5300", creditCode]);
  const rate = await resolveRateToBase(db, expense.currency_code, "USD");
  return postOperationalJournal(db, {
    entryDate: expense.incurred_at.toISOString().slice(0, 10),
    currencyCode: expense.currency_code,
    exchangeRateToBase: rate,
    description: "Expense " + expenseId,
    sourceType: "expense",
    sourceId: expenseId,
    sourceEventKey: "expense:" + expenseId + ":recorded",
    lines: [
      { accountId: accounts.get("5300")!, debitAmount: expense.amount, description: "Operating expense", customerId: null },
      { accountId: accounts.get(creditCode)!, creditAmount: expense.amount, description: expense.payment_method === "unpaid" ? "Accounts payable" : "Cash payment", customerId: null }
    ]
  }, context);
}

export async function postExpenseVoided(
  db: Database,
  expenseId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string> {
  return reverseSourceJournal(db, "expense:" + expenseId + ":recorded", context);
}

export async function postInvoiceVoided(
  db: Database,
  invoiceId: string,
  context: { actorId: string; requestId: string; idempotencyKey: string }
): Promise<string | null> {
  const rows = await db.execute(sql`SELECT journal_entry_id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`);
  const journalEntryId = (rows.rows[0] as { journal_entry_id?: string | null } | undefined)?.journal_entry_id;
  if (!journalEntryId) return null;
  return reverseSourceJournal(db, "invoice:" + invoiceId + ":issued", context);
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
  const lines: PostingLine[]=[{accountId:accounts.get("1100")!,debitAmount:invoice.total_amount,description:"Accounts receivable",customerId:invoice.customer_id}];
  for(const [code,value] of revenue)lines.push({accountId:accounts.get(code)!,creditAmount:value.toFixed(),description:"Revenue",customerId:invoice.customer_id});
  if(cogs.gt(0)){lines.push({accountId:accounts.get("5000")!,debitAmount:cogs.toFixed(),description:"Cost of goods sold",customerId:invoice.customer_id});lines.push({accountId:accounts.get("1200")!,creditAmount:cogs.toFixed(),description:"Inventory reduction",customerId:invoice.customer_id});}
  const created=await createJournal(db,{entryDate:invoice.issue_date,currencyCode:invoice.currency_code,exchangeRateToBase:rate,description:"Invoice "+invoiceId,sourceType:"invoice",sourceId:invoiceId,sourceEventKey:"invoice:"+invoiceId+":issued",lines},context);
  const posted=await postJournal(db,created.entry.id,context);
  await db.update(invoices).set({journalEntryId:posted.entry.id}).where(eq(invoices.id,invoiceId));
  return posted.entry.id;
}
