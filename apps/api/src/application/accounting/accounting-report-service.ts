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
  const totals=await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN coa.account_type='revenue' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END
        ELSE 0 END),0)::text AS revenue,
      COALESCE(SUM(CASE WHEN coa.account_type='expense' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END
        ELSE 0 END),0)::text AS expenses
    FROM journal_lines jl
    JOIN journal_entries je ON je.id=jl.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id=jl.account_id
    WHERE je.status='posted'
      AND je.entry_date BETWEEN ${startDate} AND ${endDate}
      AND coa.is_active=true
      AND coa.account_type IN ('revenue','expense')
  `);
  const totalRow=totals.rows[0] as {revenue:string;expenses:string};
  const netIncome=await db.execute(sql`
    SELECT (
      COALESCE(SUM(CASE WHEN coa.account_type='revenue'
        THEN CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
      -
      COALESCE(SUM(CASE WHEN coa.account_type='expense'
        THEN CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
    )::text AS net_income
    FROM journal_lines jl
    JOIN journal_entries je ON je.id=jl.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id=jl.account_id
    WHERE je.status='posted'
      AND je.entry_date BETWEEN ${startDate} AND ${endDate}
      AND coa.is_active=true
      AND coa.account_type IN ('revenue','expense')
  `);
  return {
    startDate,
    endDate,
    accounts:rows.rows,
    totals:{
      revenue:totalRow.revenue,
      expenses:totalRow.expenses,
      netIncome:(netIncome.rows[0] as {net_income:string}).net_income
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
  const totals=await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN coa.account_type='asset' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)::text AS assets,
      COALESCE(SUM(CASE WHEN coa.account_type='liability' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)::text AS liabilities,
      COALESCE(SUM(CASE WHEN coa.account_type='equity' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)::text AS equity
    FROM journal_lines jl
    JOIN journal_entries je ON je.id=jl.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id=jl.account_id
    WHERE je.status='posted'
      AND je.entry_date<=${asOfDate}
      AND coa.is_active=true
      AND coa.account_type IN ('asset','liability','equity')
  `);
  const totalRow=totals.rows[0] as {assets:string;liabilities:string;equity:string};
  const income=await incomeStatement(db,'0001-01-01',asOfDate);
  const currentPeriodNetIncome=income.totals.netIncome;
  const check=await db.execute(sql`
    SELECT (
      COALESCE(SUM(CASE WHEN coa.account_type='asset' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
      -
      COALESCE(SUM(CASE WHEN coa.account_type='liability' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
      -
      COALESCE(SUM(CASE WHEN coa.account_type='equity' THEN
        CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
      -
      (
        COALESCE(SUM(CASE WHEN coa.account_type='revenue' THEN
          CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
        -
        COALESCE(SUM(CASE WHEN coa.account_type='expense' THEN
          CASE WHEN coa.normal_balance='credit' THEN jl.base_credit_amount-jl.base_debit_amount ELSE jl.base_debit_amount-jl.base_credit_amount END ELSE 0 END),0)
      )
    )::text AS balance_check
    FROM journal_lines jl
    JOIN journal_entries je ON je.id=jl.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id=jl.account_id
    WHERE je.status='posted'
      AND je.entry_date<=${asOfDate}
      AND coa.is_active=true
  `);
  const balanceCheck=(check.rows[0] as {balance_check:string}).balance_check;
  return {
    asOfDate,
    accounts:rows.rows,
    totals:{
      assets:totalRow.assets,
      liabilities:totalRow.liabilities,
      equity:totalRow.equity,
      currentPeriodNetIncome,
      balanceCheck
    }
  };
}
