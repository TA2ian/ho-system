CREATE TABLE IF NOT EXISTS driver_collection_sessions (
  id uuid PRIMARY KEY,
  driver_user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid NOT NULL REFERENCES users(id),
  closed_at timestamptz,
  closed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_collection_open_driver_uq
  ON driver_collection_sessions (driver_user_id)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS driver_collection_driver_idx
  ON driver_collection_sessions (driver_user_id);
CREATE INDEX IF NOT EXISTS driver_collection_status_idx
  ON driver_collection_sessions (status);

CREATE TABLE IF NOT EXISTS driver_collection_payments (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES driver_collection_sessions(id),
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS driver_collection_payments_session_idx
  ON driver_collection_payments (session_id);

CREATE TABLE IF NOT EXISTS driver_collection_settlement_counts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES driver_collection_sessions(id),
  currency_code text NOT NULL REFERENCES currencies(code),
  method text NOT NULL CHECK (method IN ('cash', 'sham_cash')),
  expected_amount numeric(24,10) NOT NULL CHECK (expected_amount >= 0),
  counted_amount numeric(24,10) NOT NULL CHECK (counted_amount >= 0),
  difference_amount numeric(24,10) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, currency_code, method)
);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'collections.read', 'Read driver collection sessions and settlements'),
  (gen_random_uuid(), 'collections.manage', 'Open, receive into, and close driver collection sessions')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'collections.read'),
    ('owner', 'collections.manage'),
    ('admin', 'collections.read'),
    ('admin', 'collections.manage'),
    ('accountant', 'collections.read'),
    ('accountant', 'collections.manage'),
    ('operations', 'collections.read'),
    ('operations', 'collections.manage'),
    ('driver', 'collections.read'),
    ('driver', 'collections.manage')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'driver')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'payments.manage');
