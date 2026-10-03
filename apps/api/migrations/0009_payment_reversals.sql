CREATE TABLE IF NOT EXISTS payment_allocation_reversals (
  id uuid PRIMARY KEY,
  payment_allocation_id uuid NOT NULL REFERENCES payment_allocations(id),
  amount numeric(24,10) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  reason text NOT NULL,
  reversed_at timestamptz NOT NULL DEFAULT now(),
  reversed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_allocation_reversals_allocation_idx
  ON payment_allocation_reversals (payment_allocation_id);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'payments.reverse', 'Reverse recorded payments and payment allocations')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'payments.reverse'),
    ('admin', 'payments.reverse'),
    ('accountant', 'payments.reverse')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
