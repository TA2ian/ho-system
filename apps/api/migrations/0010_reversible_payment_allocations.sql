DROP INDEX IF EXISTS payment_allocations_payment_invoice_uq;

CREATE INDEX IF NOT EXISTS payment_allocations_payment_invoice_created_idx
  ON payment_allocations (payment_id, invoice_id, created_at);
