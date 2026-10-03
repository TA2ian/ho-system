CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('invited', 'active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS auth_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_identity_provider_subject_uq UNIQUE (provider, subject)
);

CREATE INDEX IF NOT EXISTS auth_identities_user_idx ON auth_identities (user_id);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles (role_id);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON role_permissions (permission_id);

CREATE TABLE IF NOT EXISTS user_access_scopes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES users(id),
  PRIMARY KEY (user_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS user_access_scopes_scope_idx
  ON user_access_scopes (scope_type, scope_id);

INSERT INTO roles (id, code, name, description, is_system)
VALUES
  (gen_random_uuid(), 'owner', 'Owner', 'Full system ownership role', true),
  (gen_random_uuid(), 'admin', 'Administrator', 'System administration role', true),
  (gen_random_uuid(), 'accountant', 'Accountant', 'Accounting and financial operations role', true),
  (gen_random_uuid(), 'sales', 'Sales', 'Sales and customer operations role', true),
  (gen_random_uuid(), 'operations', 'Operations', 'Operational workflow role', true),
  (gen_random_uuid(), 'driver', 'Driver', 'Delivery and collection role', true),
  (gen_random_uuid(), 'advertiser', 'Advertiser', 'Advertising partner campaign-management role', true),
  (gen_random_uuid(), 'employee', 'Employee', 'General employee role', true),
  (gen_random_uuid(), 'customer', 'Customer', 'Customer self-service role', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'users.manage', 'Manage users and access assignments'),
  (gen_random_uuid(), 'roles.manage', 'Manage roles and permissions'),
  (gen_random_uuid(), 'customers.read', 'Read customer records'),
  (gen_random_uuid(), 'customers.write', 'Create and update customer records'),
  (gen_random_uuid(), 'campaigns.manage', 'Manage advertising campaigns'),
  (gen_random_uuid(), 'delivery.manage', 'Manage delivery operations'),
  (gen_random_uuid(), 'catalog.manage', 'Manage products and services'),
  (gen_random_uuid(), 'sales.manage', 'Manage sales workflows'),
  (gen_random_uuid(), 'payments.manage', 'Manage payments and collections'),
  (gen_random_uuid(), 'accounting.read', 'Read accounting information'),
  (gen_random_uuid(), 'accounting.post', 'Post accounting entries'),
  (gen_random_uuid(), 'reports.read', 'Read business and financial reports'),
  (gen_random_uuid(), 'settings.manage', 'Manage system settings')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'users.manage'),
    ('owner', 'roles.manage'),
    ('owner', 'customers.read'),
    ('owner', 'customers.write'),
    ('owner', 'campaigns.manage'),
    ('owner', 'delivery.manage'),
    ('owner', 'catalog.manage'),
    ('owner', 'sales.manage'),
    ('owner', 'payments.manage'),
    ('owner', 'accounting.read'),
    ('owner', 'accounting.post'),
    ('owner', 'reports.read'),
    ('owner', 'settings.manage'),
    ('admin', 'users.manage'),
    ('admin', 'roles.manage'),
    ('admin', 'customers.read'),
    ('admin', 'customers.write'),
    ('admin', 'campaigns.manage'),
    ('admin', 'delivery.manage'),
    ('admin', 'catalog.manage'),
    ('admin', 'sales.manage'),
    ('admin', 'payments.manage'),
    ('admin', 'accounting.read'),
    ('admin', 'reports.read'),
    ('admin', 'settings.manage'),
    ('accountant', 'accounting.read'),
    ('accountant', 'accounting.post'),
    ('accountant', 'payments.manage'),
    ('accountant', 'reports.read'),
    ('sales', 'customers.read'),
    ('sales', 'customers.write'),
    ('sales', 'campaigns.manage'),
    ('sales', 'sales.manage'),
    ('sales', 'reports.read'),
    ('operations', 'delivery.manage'),
    ('operations', 'catalog.manage'),
    ('operations', 'sales.manage'),
    ('operations', 'reports.read'),
    ('driver', 'delivery.manage'),
    ('driver', 'payments.manage'),
    ('advertiser', 'campaigns.manage'),
    ('employee', 'reports.read'),
    ('customer', 'customers.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
