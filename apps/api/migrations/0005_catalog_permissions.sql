INSERT INTO permissions (id, code, description)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  'catalog.read',
  'Read catalog categories and items'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('owner', 'admin', 'accountant', 'sales', 'operations', 'driver', 'employee')
  AND p.code = 'catalog.read'
ON CONFLICT DO NOTHING;
