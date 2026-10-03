CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('individual', 'business')),
  display_name text NOT NULL,
  phone text,
  email text,
  notes text,
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_status_idx ON customers (status);
CREATE INDEX IF NOT EXISTS customers_display_name_idx ON customers (display_name);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);
