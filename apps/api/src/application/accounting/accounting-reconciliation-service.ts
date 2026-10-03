import { sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";

type ReconciliationIssue = {
  category: string;
  issue: "missing_posting" | "unposted_posting" | "missing_reversal";
  sourceId: string;
  expectedEventKey: string;
  sourceDate: string;
  journalEntryId: string | null;
};

export async function reconcileOperationalJournals(
  db: Database,
  startDate: string,
  endDate: string
) {
  const postingRows = await db.execute(sql`
    WITH expected AS (
      SELECT 'invoice'::text AS category, i.id::text AS source_id,
             i.issue_date::date AS source_date,
             ('invoice:' || i.id || ':issued')::text AS event_key
      FROM invoices i
      WHERE i.status IN ('issued', 'voided')
        AND i.issue_date IS NOT NULL
        AND i.issue_date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'payment', p.id::text, p.received_at::date,
             ('payment:' || p.id || ':recorded')::text
      FROM payments p
      WHERE p.received_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'payment_allocation', pa.id::text, pa.created_at::date,
             ('payment-allocation:' || pa.id || ':allocated')::text
      FROM payment_allocations pa
      WHERE pa.created_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'campaign_spend', cse.id::text, cse.spent_at::date,
             ('campaign-spend:' || cse.id || ':recorded')::text
      FROM campaign_spend_entries cse
      WHERE cse.spent_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'expense', e.id::text, e.incurred_at::date,
             ('expense:' || e.id || ':recorded')::text
      FROM expenses e
      WHERE e.incurred_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'employee_task', et.id::text, et.completed_at::date,
             ('employee-task:' || et.id || ':completed')::text
      FROM employee_tasks et
      WHERE et.status = 'completed'
        AND et.completed_at IS NOT NULL
        AND et.completed_at::date BETWEEN ${startDate}::date AND ${endDate}::date
    )
    SELECT e.category, e.source_id, e.source_date::text, e.event_key,
           je.id::text AS journal_entry_id, je.status,
           COUNT(*) OVER ()::int AS total_expected
    FROM expected e
    LEFT JOIN journal_entries je ON je.source_event_key = e.event_key
    ORDER BY e.source_date, e.category, e.source_id
  \`);

  const reversalRows = await db.execute(sql`
    WITH expected_reversals AS (
      SELECT 'invoice'::text AS category, i.id::text AS source_id,
             ('invoice:' || i.id || ':issued')::text AS event_key,
             i.issue_date::date AS source_date
      FROM invoices i
      WHERE i.status = 'voided'
        AND i.issue_date IS NOT NULL
        AND i.issue_date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'payment', p.id::text,
             ('payment:' || p.id || ':recorded')::text,
             p.received_at::date
      FROM payments p
      WHERE p.status = 'voided'
        AND p.received_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'expense', e.id::text,
             ('expense:' || e.id || ':recorded')::text,
             e.incurred_at::date
      FROM expenses e
      WHERE e.status = 'voided'
        AND e.incurred_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'payment_allocation', par.payment_allocation_id::text,
             ('payment-allocation:' || par.payment_allocation_id || ':allocated')::text,
             par.reversed_at::date
      FROM payment_allocation_reversals par
      WHERE par.reversed_at::date BETWEEN ${startDate}::date AND ${endDate}::date
      UNION ALL
      SELECT 'campaign_spend', csr.spend_id::text,
             ('campaign-spend:' || csr.spend_id || ':recorded')::text,
             csr.reversed_at::date
      FROM campaign_spend_reversals csr
      WHERE csr.reversed_at::date BETWEEN ${startDate}::date AND ${endDate}::date
    )
    SELECT er.category, er.source_id, er.source_date::text, er.event_key,
           original.id::text AS original_journal_entry_id,
           original.status AS original_status,
           reversal.id::text AS reversal_journal_entry_id,
           reversal.status AS reversal_status,
           COUNT(*) OVER ()::int AS total_expected
    FROM expected_reversals er
    LEFT JOIN journal_entries original ON original.source_event_key = er.event_key
    LEFT JOIN journal_entries reversal ON reversal.reverses_entry_id = original.id
    ORDER BY er.source_date, er.category, er.source_id
  \`);

  const issues: ReconciliationIssue[] = [];

  for (const row of postingRows.rows as Array<{
    category: string;
    source_id: string;
    source_date: string;
    event_key: string;
    journal_entry_id: string | null;
    status: string | null;
    total_expected: number;
  }>) {
    if (row.journal_entry_id === null || row.status !== "posted") {
      issues.push({
        category: row.category,
        issue: row.journal_entry_id === null ? "missing_posting" : "unposted_posting",
      sourceId: row.source_id,
      expectedEventKey: row.event_key,
      sourceDate: row.source_date,
        journalEntryId: row.journal_entry_id
      });
    }
  }

  for (const row of reversalRows.rows as Array<{
    category: string;
    source_id: string;
    source_date: string;
    event_key: string;
    original_journal_entry_id: string | null;
    original_status: string | null;
    reversal_journal_entry_id: string | null;
    reversal_status: string | null;
    total_expected: number;
  }>) {
    if (row.original_journal_entry_id && row.original_status === "posted" &&
        (!row.reversal_journal_entry_id || row.reversal_status !== "posted")) {
      issues.push({
        category: row.category,
        issue: "missing_reversal",
      sourceId: row.source_id,
      expectedEventKey: row.event_key,
      sourceDate: row.source_date,
        journalEntryId: row.reversal_journal_entry_id ?? row.original_journal_entry_id
      });
    }
  }

  const postingSample = postingRows.rows[0] as { total_expected?: number } | undefined;
  const reversalSample = reversalRows.rows[0] as { total_expected?: number } | undefined;
  const summary = {
    checkedPostings: postingSample?.total_expected ?? 0,
    checkedReversals: reversalSample?.total_expected ?? 0,
    issueCount: issues.length,
    missingPostings: issues.filter((item) => item.issue === "missing_posting").length,
    unpostedPostings: issues.filter((item) => item.issue === "unposted_posting").length,
    missingReversals: issues.filter((item) => item.issue === "missing_reversal").length
  };

  return { startDate, endDate, summary, issues };
}
