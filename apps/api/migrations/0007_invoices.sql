CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  source_sales_order_id uuid UNIQUE REFERENCES sales_orders(id),
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'issued', 'voided')),
  currency_code text NOT NULL REFERENCES currencies(code),
  total_amount numeric(24,10) NOT NULL CHECK (total_amount >= 0),
  issue_date date,
  due_date date,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  issued_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON invoices (due_date);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  sales_order_line_id uuid NOT NULL REFERENCES sales_order_lines(id),
  description text NOT NULL,
  quantity numeric(24,10) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  unit_price numeric(24,10) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(24,10) NOT NULL CHECK (line_total >= 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_lines_invoice_line_uq UNIQUE (invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON invoice_lines (invoice_id);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'invoices.read', 'Read invoice and receivable documents'),
  (gen_random_uuid(), 'invoices.manage', 'Create, issue and void invoices')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'invoices.read'),
    ('owner', 'invoices.manage'),
    ('admin', 'invoices.read'),
    ('admin', 'invoices.manage'),
    ('accountant', 'invoices.read'),
    ('accountant', 'invoices.manage'),
    ('sales', 'invoices.read'),
    ('sales', 'invoices.manage'),
    ('operations', 'invoices.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
