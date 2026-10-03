CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  payment_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('recorded', 'voided')),
  amount numeric(24,10) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  method text NOT NULL CHECK (method IN ('cash', 'sham_cash')),
  reference text,
  received_at timestamptz NOT NULL,
  received_by uuid NOT NULL REFERENCES users(id),
  notes text,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments (customer_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_received_at_idx ON payments (received_at);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount numeric(24,10) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_allocations_payment_invoice_uq
  ON payment_allocations (payment_id, invoice_id);
CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx
  ON payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx
  ON payment_allocations (invoice_id);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'payments.read', 'Read payment and receivable allocation documents'),
  (gen_random_uuid(), 'payments.manage', 'Record payments and allocate them to invoices')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'payments.read'),
    ('owner', 'payments.manage'),
    ('admin', 'payments.read'),
    ('admin', 'payments.manage'),
    ('accountant', 'payments.read'),
    ('accountant', 'payments.manage'),
    ('sales', 'payments.read'),
    ('sales', 'payments.manage'),
    ('operations', 'payments.read'),
    ('driver', 'payments.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
