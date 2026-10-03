CREATE TABLE IF NOT EXISTS catalog_categories (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_categories_code_uq UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS catalog_categories_active_idx
  ON catalog_categories (is_active);

CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES catalog_categories(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  item_kind text NOT NULL CHECK (item_kind IN ('product', 'material', 'service')),
  unit text NOT NULL,
  currency_code text NOT NULL REFERENCES currencies(code),
  cost_price numeric(24,10) NOT NULL CHECK (cost_price >= 0),
  sale_price numeric(24,10) NOT NULL CHECK (sale_price >= 0),
  is_deliverable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_items_code_uq UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS catalog_items_category_idx
  ON catalog_items (category_id);

CREATE INDEX IF NOT EXISTS catalog_items_active_idx
  ON catalog_items (is_active);

CREATE INDEX IF NOT EXISTS catalog_items_kind_idx
  ON catalog_items (item_kind);

INSERT INTO catalog_categories (id, code, name, description, is_system)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'advertising', 'إعلانات', 'خدمات ومواد مرتبطة بالإعلانات', true),
  ('10000000-0000-4000-8000-000000000002', 'delivery', 'توصيل', 'خدمات ومواد مرتبطة بالتوصيل', true),
  ('10000000-0000-4000-8000-000000000003', 'digital-services', 'خدمات رقمية', 'الخدمات الرقمية والتقنية', true),
  ('10000000-0000-4000-8000-000000000004', 'materials', 'مواد', 'المواد واللوازم القابلة للبيع أو التسليم', true),
  ('10000000-0000-4000-8000-000000000005', 'other', 'أخرى', 'تصنيف مرن للعناصر الأخرى', true)
ON CONFLICT (code) DO NOTHING;
