CREATE TABLE IF NOT EXISTS delivery_orders (
  id uuid PRIMARY KEY,
  delivery_number text NOT NULL UNIQUE,
  delivery_type text NOT NULL CHECK (delivery_type IN ('external', 'internal')),
  customer_id uuid REFERENCES customers(id),
  sales_order_id uuid REFERENCES sales_orders(id),
  invoice_id uuid REFERENCES invoices(id),
  assigned_driver_id uuid REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('pending', 'assigned', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled')),
  address text,
  contact_name text,
  contact_phone text,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  returned_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_orders_type_reference_ck CHECK (
    (delivery_type = 'external' AND customer_id IS NOT NULL AND invoice_id IS NOT NULL)
    OR (delivery_type = 'internal' AND customer_id IS NULL AND invoice_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS delivery_orders_customer_idx ON delivery_orders (customer_id);
CREATE INDEX IF NOT EXISTS delivery_orders_invoice_idx ON delivery_orders (invoice_id);
CREATE INDEX IF NOT EXISTS delivery_orders_driver_idx ON delivery_orders (assigned_driver_id);
CREATE INDEX IF NOT EXISTS delivery_orders_status_idx ON delivery_orders (status);
CREATE INDEX IF NOT EXISTS delivery_orders_type_status_idx ON delivery_orders (delivery_type, status);
CREATE TABLE IF NOT EXISTS delivery_order_payments (
  id uuid PRIMARY KEY,
  delivery_order_id uuid NOT NULL REFERENCES delivery_orders(id),
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_order_payments_delivery_idx ON delivery_order_payments (delivery_order_id);
INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'delivery.read', 'Read delivery orders and driver assignments'),
  (gen_random_uuid(), 'delivery.manage', 'Create and manage delivery orders'),
  (gen_random_uuid(), 'delivery.assign', 'Assign drivers to delivery orders'),
  (gen_random_uuid(), 'delivery.status', 'Update delivery execution status')
ON CONFLICT (code) DO NOTHING;
WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'delivery.read'), ('owner', 'delivery.manage'), ('owner', 'delivery.assign'), ('owner', 'delivery.status'),
    ('admin', 'delivery.read'), ('admin', 'delivery.manage'), ('admin', 'delivery.assign'), ('admin', 'delivery.status'),
    ('operations', 'delivery.read'), ('operations', 'delivery.manage'), ('operations', 'delivery.assign'), ('operations', 'delivery.status'),
    ('sales', 'delivery.read'),
    ('driver', 'delivery.read'), ('driver', 'delivery.status')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
