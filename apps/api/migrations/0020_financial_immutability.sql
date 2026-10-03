ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_payment_id_fkey;
ALTER TABLE payment_allocations
  ADD CONSTRAINT payment_allocations_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION prevent_financial_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'payment_allocations' OR TG_TABLE_NAME = 'payment_allocation_reversals' OR TG_TABLE_NAME = 'campaign_spend_entries' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'payments' THEN
    IF TG_OP = 'DELETE' OR OLD.status = 'voided' OR NOT (OLD.status = 'recorded' AND NEW.status = 'voided') THEN
      RAISE EXCEPTION 'payment mutation is not allowed; use reversal';
    END IF;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    IF TG_OP = 'DELETE' OR NOT (
      (OLD.status = 'draft' AND NEW.status = 'issued')
      OR (OLD.status = 'issued' AND NEW.status = 'voided')
    ) THEN
      RAISE EXCEPTION 'invoice mutation is not allowed; use lifecycle transition';
    END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    IF TG_OP = 'DELETE' OR NOT (OLD.status = 'recorded' AND NEW.status = 'voided') THEN
      RAISE EXCEPTION 'expense mutation is not allowed; use void transition';
    END IF;
  ELSIF TG_TABLE_NAME = 'employee_tasks' THEN
    IF TG_OP = 'DELETE' OR OLD.status IN ('completed','cancelled') THEN
      RAISE EXCEPTION 'completed or cancelled employee tasks are immutable';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payments_financial_immutable ON payments;
CREATE TRIGGER payments_financial_immutable
BEFORE UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

DROP TRIGGER IF EXISTS invoices_financial_immutable ON invoices;
CREATE TRIGGER invoices_financial_immutable
BEFORE UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

DROP TRIGGER IF EXISTS expenses_financial_immutable ON expenses;
CREATE TRIGGER expenses_financial_immutable
BEFORE UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

DROP TRIGGER IF EXISTS payment_allocations_financial_immutable ON payment_allocations;
CREATE TRIGGER payment_allocations_financial_immutable
BEFORE UPDATE OR DELETE ON payment_allocations
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

DROP TRIGGER IF EXISTS payment_allocation_reversals_financial_immutable ON payment_allocation_reversals;
CREATE TRIGGER payment_allocation_reversals_financial_immutable
BEFORE UPDATE OR DELETE ON payment_allocation_reversals
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

DROP TRIGGER IF EXISTS campaign_spend_financial_immutable ON campaign_spend_entries;
CREATE TRIGGER campaign_spend_financial_immutable
BEFORE UPDATE OR DELETE ON campaign_spend_entries
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();

DROP TRIGGER IF EXISTS employee_tasks_completion_immutable ON employee_tasks;
CREATE TRIGGER employee_tasks_completion_immutable
BEFORE UPDATE OR DELETE ON employee_tasks
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
