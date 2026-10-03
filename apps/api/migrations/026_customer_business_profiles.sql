CREATE TABLE customer_business_profiles (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  legal_name text,
  registration_number text,
  tax_number text,
  industry text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
