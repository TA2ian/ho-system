CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  minor_unit smallint NOT NULL CHECK (minor_unit BETWEEN 0 AND 6),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS currencies_active_idx
  ON currencies (is_active);

INSERT INTO currencies (code, name, minor_unit)
VALUES
  ('USD', 'US Dollar', 2),
  ('SYP', 'Syrian Pound', 2)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY,
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT idempotency_response_status_ck
    CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599)
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_scope_key_uq
  ON idempotency_keys (scope, idempotency_key);

CREATE INDEX IF NOT EXISTS idempotency_expires_at_idx
  ON idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  request_id text,
  idempotency_key text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_actor_idx
  ON audit_events (actor_id);

CREATE INDEX IF NOT EXISTS audit_resource_idx
  ON audit_events (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS audit_created_at_idx
  ON audit_events (created_at);

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_mutation();

CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY,
  base_currency_code text NOT NULL REFERENCES currencies(code),
  quote_currency_code text NOT NULL REFERENCES currencies(code),
  rate numeric(24, 10) NOT NULL CHECK (rate > 0),
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exchange_rates_pair_ck
    CHECK (base_currency_code <> quote_currency_code)
);

CREATE INDEX IF NOT EXISTS exchange_rates_pair_observed_idx
  ON exchange_rates (base_currency_code, quote_currency_code, observed_at DESC);
