CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY,
  expense_number text NOT NULL UNIQUE,
  category text NOT NULL,
  vendor_name text,
  description text NOT NULL,
  amount numeric(24,10) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'sham_cash', 'unpaid')),
  status text NOT NULL CHECK (status IN ('recorded', 'voided')),
  incurred_at timestamptz NOT NULL,
  paid_at timestamptz,
  paid_by uuid REFERENCES users(id),
  reference text,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_payment_state_ck CHECK (
    (payment_method = 'unpaid' AND paid_at IS NULL)
    OR
    (payment_method IN ('cash', 'sham_cash') AND paid_at IS NOT NULL AND paid_by IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status);
CREATE INDEX IF NOT EXISTS expenses_incurred_at_idx ON expenses (incurred_at);
CREATE INDEX IF NOT EXISTS expenses_currency_idx ON expenses (currency_code);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'expenses.read', 'Read recorded expenses'),
  (gen_random_uuid(), 'expenses.manage', 'Record and void expenses')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'expenses.read'), ('owner', 'expenses.manage'),
    ('admin', 'expenses.read'), ('admin', 'expenses.manage'),
    ('accountant', 'expenses.read'), ('accountant', 'expenses.manage'),
    ('operations', 'expenses.read'), ('operations', 'expenses.manage')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
