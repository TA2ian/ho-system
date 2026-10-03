INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'exchange_rates.read', 'Read exchange rates'),
  (gen_random_uuid(), 'exchange_rates.manage', 'Record exchange rates')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner','exchange_rates.read'),('owner','exchange_rates.manage'),
    ('admin','exchange_rates.read'),('admin','exchange_rates.manage'),
    ('accountant','exchange_rates.read'),('accountant','exchange_rates.manage'),
    ('operations','exchange_rates.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id,p.id FROM role_permission_codes rpc
JOIN roles r ON r.code=rpc.role_code
JOIN permissions p ON p.code=rpc.permission_code
ON CONFLICT DO NOTHING;
