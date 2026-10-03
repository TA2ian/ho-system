CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  currency_code text NOT NULL REFERENCES currencies(code),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_orders_customer_idx ON sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS sales_orders_status_idx ON sales_orders (status);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id uuid PRIMARY KEY,
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  catalog_item_id uuid NOT NULL REFERENCES catalog_items(id),
  description text NOT NULL,
  quantity numeric(24,10) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  unit_cost numeric(24,10) NOT NULL CHECK (unit_cost >= 0),
  unit_price numeric(24,10) NOT NULL CHECK (unit_price >= 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_order_lines_order_line_uq UNIQUE (sales_order_id, line_number)
);

CREATE INDEX IF NOT EXISTS sales_order_lines_order_idx ON sales_order_lines (sales_order_id);
