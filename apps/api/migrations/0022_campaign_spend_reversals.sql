CREATE OR REPLACE FUNCTION prevent_financial_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('payment_allocations', 'payment_allocation_reversals', 'campaign_spend_entries', 'campaign_spend_reversals') THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
  END IF;
  IF TG_TABLE_NAME = 'payments' THEN
    IF TG_OP = 'DELETE' OR OLD.status = 'voided' OR NOT (OLD.status = 'recorded' AND NEW.status = 'voided') THEN
      RAISE EXCEPTION 'payment mutation is not allowed; use reversal';
    END IF;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    IF TG_OP = 'DELETE' OR NOT ((OLD.status = 'draft' AND NEW.status = 'issued') OR (OLD.status = 'issued' AND NEW.status = 'voided')) THEN
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

CREATE TABLE IF NOT EXISTS campaign_spend_reversals (
  id uuid PRIMARY KEY,
  spend_id uuid NOT NULL UNIQUE REFERENCES campaign_spend_entries(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  reversed_by uuid NOT NULL REFERENCES users(id),
  reversed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_spend_reversals_spend_idx
  ON campaign_spend_reversals (spend_id);
CREATE INDEX IF NOT EXISTS campaign_spend_reversals_reversed_at_idx
  ON campaign_spend_reversals (reversed_at);

DROP TRIGGER IF EXISTS campaign_spend_reversals_financial_immutable ON campaign_spend_reversals;
CREATE TRIGGER campaign_spend_reversals_financial_immutable
BEFORE UPDATE OR DELETE ON campaign_spend_reversals
FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation();
