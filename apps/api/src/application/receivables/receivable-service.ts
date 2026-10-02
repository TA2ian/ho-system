import { sql } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { ApplicationError } from "../../domain/errors.js";

const uuidSchema = z.string().uuid();

type ReceivableRow = {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  currency_code: string;
  total_amount: string;
  issue_date: string | null;
  due_date: string | null;
  allocated_amount: string;
  outstanding_amount: string;
};

function mapReceivable(row: ReceivableRow) {
  return {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    currencyCode: row.currency_code,
    totalAmount: row.total_amount,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    allocatedAmount: row.allocated_amount,
    outstandingAmount: row.outstanding_amount
  };
}

export async function getInvoiceReceivable(db: Database, invoiceId: string) {
  const parsedId = uuidSchema.safeParse(invoiceId);
  if (!parsedId.success) {
    throw new ApplicationError("INVOICE_ID_INVALID", 400, "معرّف الفاتورة غير صالح");
  }

  const result = await db.execute(sql<ReceivableRow>`
    SELECT
      i.id AS invoice_id,
      i.invoice_number,
      i.customer_id,
      i.currency_code,
      i.total_amount::text AS total_amount,
      i.issue_date::text AS issue_date,
      i.due_date::text AS due_date,
      (
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.invoice_id = i.id
        ), 0)
        -
        COALESCE((
          SELECT SUM(par.amount)
          FROM payment_allocation_reversals par
          JOIN payment_allocations pa2 ON pa2.id = par.payment_allocation_id
          WHERE pa2.invoice_id = i.id
        ), 0)
      )::text AS allocated_amount,
      (
        i.total_amount
        -
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.invoice_id = i.id
        ), 0)
        +
        COALESCE((
          SELECT SUM(par.amount)
          FROM payment_allocation_reversals par
          JOIN payment_allocations pa2 ON pa2.id = par.payment_allocation_id
          WHERE pa2.invoice_id = i.id
        ), 0)
      )::text AS outstanding_amount
    FROM invoices i
    WHERE i.id = ${invoiceId}::uuid
      AND i.status = 'issued'
  `);

  const row = (result.rows as Array<ReceivableRow>)[0];
  if (!row) {
    throw new ApplicationError("RECEIVABLE_NOT_FOUND", 404, "الذمة المستحقة غير موجودة أو الفاتورة غير صادرة");
  }

  const outstanding = new Decimal(row.outstanding_amount);
  if (outstanding.isNegative()) {
    throw new ApplicationError("RECEIVABLE_INVARIANT_BROKEN", 500, "تعذر حساب الرصيد المستحق");
  }

  return mapReceivable(row);
}

export async function listCustomerReceivables(db: Database, customerId: string) {
  const parsedId = uuidSchema.safeParse(customerId);
  if (!parsedId.success) {
    throw new ApplicationError("CUSTOMER_ID_INVALID", 400, "معرّف العميل غير صالح");
  }

  const result = await db.execute(sql<ReceivableRow>`
    SELECT
      i.id AS invoice_id,
      i.invoice_number,
      i.customer_id,
      i.currency_code,
      i.total_amount::text AS total_amount,
      i.issue_date::text AS issue_date,
      i.due_date::text AS due_date,
      (
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.invoice_id = i.id
        ), 0)
        -
        COALESCE((
          SELECT SUM(par.amount)
          FROM payment_allocation_reversals par
          JOIN payment_allocations pa2 ON pa2.id = par.payment_allocation_id
          WHERE pa2.invoice_id = i.id
        ), 0)
      )::text AS allocated_amount,
      (
        i.total_amount
        -
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.invoice_id = i.id
        ), 0)
        +
        COALESCE((
          SELECT SUM(par.amount)
          FROM payment_allocation_reversals par
          JOIN payment_allocations pa2 ON pa2.id = par.payment_allocation_id
          WHERE pa2.invoice_id = i.id
        ), 0)
      )::text AS outstanding_amount
    FROM invoices i
    WHERE i.customer_id = ${customerId}::uuid
      AND i.status = 'issued'
    ORDER BY i.due_date NULLS LAST, i.issue_date DESC, i.invoice_number DESC
  `);

  const rows = result.rows as Array<ReceivableRow>;
  return rows.map((row) => {
    const outstanding = new Decimal(row.outstanding_amount);
    if (outstanding.isNegative()) {
      throw new ApplicationError("RECEIVABLE_INVARIANT_BROKEN", 500, "تعذر حساب الرصيد المستحق");
    }
    return mapReceivable(row);
  });
}
