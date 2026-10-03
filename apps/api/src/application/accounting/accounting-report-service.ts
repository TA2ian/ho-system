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

export async function incomeStatement(db:Database,startDate:string,endDate:string){
  const rows=await db.execute(sql`
    SELECT coa.id,coa.code,coa.name,coa.account_type,coa.normal_balance,
      COALESCE(SUM(jl.base_debit_amount),0)::text AS total_debit,
      COALESCE(SUM(jl.base_credit_amount),0)::text AS total_credit,
      CASE
        WHEN coa.normal_balance='credit'
          THEN (COALESCE(SUM(jl.base_credit_amount),0)-COALESCE(SUM(jl.base_debit_amount),0))
        ELSE (COALESCE(SUM(jl.base_debit_amount),0)-COALESCE(SUM(jl.base_credit_amount),0))
      END::text AS balance
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id=coa.id
    LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
      AND je.status='posted'
      AND je.entry_date BETWEEN ${startDate} AND ${endDate}
    WHERE coa.is_active=true
      AND coa.account_type IN ('revenue','expense')
      AND (je.id IS NOT NULL OR jl.id IS NULL)
    GROUP BY coa.id,coa.code,coa.name,coa.account_type,coa.normal_balance
    ORDER BY coa.account_type,coa.code
  `);
  const accounts=rows.rows;
  const revenue=accounts.filter((row)=>row.account_type==='revenue');
  const expense=accounts.filter((row)=>row.account_type==='expense');
  const sum=(items:typeof accounts)=>items.reduce((total,row)=>total+Number(row.balance),0);
  const totalRevenue=sum(revenue);
  const totalExpenses=sum(expense);
  return {
    startDate,
    endDate,
    accounts,
    totals:{
      revenue:totalRevenue.toString(),
      expenses:totalExpenses.toString(),
      netIncome:(totalRevenue-totalExpenses).toString()
    }
  };
}

export async function balanceSheet(db:Database,asOfDate:string){
  const rows=await db.execute(sql`
    SELECT coa.id,coa.code,coa.name,coa.account_type,coa.normal_balance,
      COALESCE(SUM(jl.base_debit_amount),0)::text AS total_debit,
      COALESCE(SUM(jl.base_credit_amount),0)::text AS total_credit,
      CASE
        WHEN coa.normal_balance='credit'
          THEN (COALESCE(SUM(jl.base_credit_amount),0)-COALESCE(SUM(jl.base_debit_amount),0))
        ELSE (COALESCE(SUM(jl.base_debit_amount),0)-COALESCE(SUM(jl.base_credit_amount),0))
      END::text AS balance
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id=coa.id
    LEFT JOIN journal_entries je ON je.id=jl.journal_entry_id
      AND je.status='posted'
      AND je.entry_date<=${asOfDate}
    WHERE coa.is_active=true
      AND coa.account_type IN ('asset','liability','equity')
      AND (je.id IS NOT NULL OR jl.id IS NULL)
    GROUP BY coa.id,coa.code,coa.name,coa.account_type,coa.normal_balance
    ORDER BY coa.account_type,coa.code
  `);
  const accounts=rows.rows;
  const sumType=(type:string)=>accounts
    .filter((row)=>row.account_type===type)
    .reduce((total,row)=>total+Number(row.balance),0);
  const assets=sumType('asset');
  const liabilities=sumType('liability');
  const equityAccounts=sumType('equity');

  const income=await incomeStatement(db,'0001-01-01',asOfDate);
  const currentNetIncome=Number(income.totals.netIncome);
  const totalEquity=equityAccounts+currentNetIncome;
  return {
    asOfDate,
    accounts,
    totals:{
      assets:assets.toString(),
      liabilities:liabilities.toString(),
      equity:totalEquity.toString(),
      currentPeriodNetIncome:currentNetIncome.toString(),
      liabilitiesAndEquity:(liabilities+totalEquity).toString(),
      balanceCheck:(assets-(liabilities+totalEquity)).toString()
    }
  };
}
