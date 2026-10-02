import { sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";

export async function trialBalance(db:Database,asOfDate:string){
  const rows=await db.execute(sql`
    SELECT coa.id,coa.code,coa.name,coa.account_type,coa.normal_balance,
      COALESCE(SUM(jl.base_debit_amount),0)::text AS total_debit,
      COALESCE(SUM(jl.base_credit_amount),0)::text AS total_credit,
      (COALESCE(SUM(jl.base_debit_amount),0)-COALESCE(SUM(jl.base_credit_amount),0))::text AS net_balance
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id=coa.id
    LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id AND je.status='posted' AND je.entry_date<=${asOfDate}
    WHERE coa.is_active=true AND (je.id IS NOT NULL OR jl.id IS NULL)
    GROUP BY coa.id,coa.code,coa.name,coa.account_type,coa.normal_balance
    ORDER BY coa.code
  `);
  return rows.rows;
}

export async function generalLedger(db:Database,accountId:string,startDate:string,endDate:string){
  const rows=await db.execute(sql`
    SELECT je.id AS journal_entry_id,je.entry_number,je.entry_date,je.description,
      jl.line_number,jl.description AS line_description,jl.currency_code,
      jl.debit_amount::text AS debit_amount,jl.credit_amount::text AS credit_amount,
      jl.base_debit_amount::text AS base_debit_amount,jl.base_credit_amount::text AS base_credit_amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id=jl.journal_entry_id
    WHERE jl.account_id=${accountId}::uuid AND je.status='posted' AND je.entry_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY je.entry_date,je.entry_number,jl.line_number
  `);
  return rows.rows;
}
