INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'receivables.read', 'Read customer and invoice receivable balances')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'receivables.read'),
    ('admin', 'receivables.read'),
    ('accountant', 'receivables.read'),
    ('sales', 'receivables.read'),
    ('operations', 'receivables.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
