CREATE TABLE IF NOT EXISTS employee_compensation_rules (
  id uuid PRIMARY KEY,
  employee_user_id uuid NOT NULL REFERENCES users(id),
  sale_type text,
  method text NOT NULL CHECK (method IN ('percentage', 'fixed_per_task', 'fixed_per_sale', 'fixed_salary')),
  rate_percent numeric(7,4) CHECK (rate_percent IS NULL OR (rate_percent >= 0 AND rate_percent <= 100)),
  fixed_amount numeric(24,10) CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  currency_code text REFERENCES currencies(code),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compensation_rule_shape_ck CHECK (
    (method = 'percentage' AND rate_percent IS NOT NULL AND fixed_amount IS NULL AND sale_type IS NOT NULL)
    OR (method IN ('fixed_per_task', 'fixed_per_sale') AND rate_percent IS NULL AND fixed_amount IS NOT NULL AND sale_type IS NOT NULL)
    OR (method = 'fixed_salary' AND rate_percent IS NULL AND fixed_amount IS NOT NULL AND sale_type IS NULL AND currency_code IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS compensation_rules_employee_idx ON employee_compensation_rules (employee_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS compensation_rules_active_sale_uq
  ON employee_compensation_rules (employee_user_id, sale_type)
  WHERE is_active AND sale_type IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compensation_rules_active_salary_uq
  ON employee_compensation_rules (employee_user_id)
  WHERE is_active AND method = 'fixed_salary';

CREATE TABLE IF NOT EXISTS employee_tasks (
  id uuid PRIMARY KEY,
  employee_user_id uuid NOT NULL REFERENCES users(id),
  task_type text NOT NULL,
  sale_type text,
  source_sales_order_id uuid REFERENCES sales_orders(id),
  basis_amount numeric(24,10) NOT NULL DEFAULT 0 CHECK (basis_amount >= 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  status text NOT NULL CHECK (status IN ('assigned', 'completed', 'cancelled')),
  compensation_rule_id uuid REFERENCES employee_compensation_rules(id),
  compensation_amount numeric(24,10),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_tasks_employee_idx ON employee_tasks (employee_user_id);
CREATE INDEX IF NOT EXISTS employee_tasks_status_idx ON employee_tasks (status);
CREATE INDEX IF NOT EXISTS employee_tasks_sale_type_idx ON employee_tasks (sale_type);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'compensation.read', 'Read employee compensation rules and task compensation'),
  (gen_random_uuid(), 'compensation.manage', 'Manage employee compensation rules'),
  (gen_random_uuid(), 'employee_tasks.read', 'Read employee tasks'),
  (gen_random_uuid(), 'employee_tasks.manage', 'Create and complete employee tasks')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'compensation.read'), ('owner', 'compensation.manage'), ('owner', 'employee_tasks.read'), ('owner', 'employee_tasks.manage'),
    ('admin', 'compensation.read'), ('admin', 'compensation.manage'), ('admin', 'employee_tasks.read'), ('admin', 'employee_tasks.manage'),
    ('accountant', 'compensation.read'), ('operations', 'compensation.read'), ('operations', 'employee_tasks.read'), ('operations', 'employee_tasks.manage'),
    ('employee', 'employee_tasks.read'), ('employee', 'employee_tasks.manage'),
    ('driver', 'employee_tasks.read'), ('driver', 'employee_tasks.manage')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
