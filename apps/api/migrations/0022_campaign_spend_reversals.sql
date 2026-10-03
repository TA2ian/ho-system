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

CREATE OR REPLACE FUNCTION prevent_campaign_spend_reversal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS 'BEGIN
  RAISE EXCEPTION ''campaign_spend_reversals is append-only'';
END;';

DROP TRIGGER IF EXISTS campaign_spend_reversals_financial_immutable ON campaign_spend_reversals;
CREATE TRIGGER campaign_spend_reversals_financial_immutable
BEFORE UPDATE OR DELETE ON campaign_spend_reversals
FOR EACH ROW EXECUTE FUNCTION prevent_campaign_spend_reversal_mutation();
