CREATE TABLE media_agreements (
  id uuid PRIMARY KEY,
  agreement_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  starts_on date NOT NULL,
  ends_on date,
  status text NOT NULL,
  client_price numeric(24,10) NOT NULL,
  advertising_budget numeric(24,10) NOT NULL,
  management_component numeric(24,10) NOT NULL,
  currency_code text NOT NULL REFERENCES currencies(code),
  payment_terms text,
  accounting_policy text,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_agreements_dates_ck CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT media_agreements_amounts_ck CHECK (
    client_price >= 0 AND advertising_budget >= 0 AND management_component >= 0
  )
);
CREATE INDEX media_agreements_customer_idx ON media_agreements(customer_id);
CREATE INDEX media_agreements_status_idx ON media_agreements(status);
CREATE INDEX media_agreements_dates_idx ON media_agreements(starts_on, ends_on);
