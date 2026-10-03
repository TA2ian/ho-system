CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY,
  campaign_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  partner_user_id uuid REFERENCES users(id),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'planned', 'active', 'paused', 'completed', 'cancelled')),
  currency_code text NOT NULL REFERENCES currencies(code),
  gross_amount numeric(24,10) NOT NULL CHECK (gross_amount >= 0),
  planned_ad_spend numeric(24,10) NOT NULL CHECK (planned_ad_spend >= 0),
  management_fee_amount numeric(24,10) NOT NULL CHECK (management_fee_amount >= 0),
  partner_share_percent numeric(7,4) NOT NULL CHECK (partner_share_percent >= 0 AND partner_share_percent <= 100),
  starts_on date,
  ends_on date,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_date_range_ck CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS campaigns_customer_idx ON campaigns (customer_id);
CREATE INDEX IF NOT EXISTS campaigns_partner_idx ON campaigns (partner_user_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

CREATE TABLE IF NOT EXISTS campaign_invoices (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, invoice_id),
  UNIQUE (invoice_id)
);
CREATE INDEX IF NOT EXISTS campaign_invoices_campaign_idx ON campaign_invoices (campaign_id);

CREATE TABLE IF NOT EXISTS campaign_spend_entries (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  amount numeric(24,10) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL REFERENCES currencies(code),
  spent_at timestamptz NOT NULL,
  reference text,
  notes text,
  recorded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_spend_campaign_idx ON campaign_spend_entries (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_spend_spent_at_idx ON campaign_spend_entries (spent_at);

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'campaigns.read', 'Read campaigns and advertising spend'),
  (gen_random_uuid(), 'campaigns.manage', 'Create and manage campaigns'),
  (gen_random_uuid(), 'campaigns.spend', 'Record manual campaign advertising spend')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner', 'campaigns.read'), ('owner', 'campaigns.manage'), ('owner', 'campaigns.spend'),
    ('admin', 'campaigns.read'), ('admin', 'campaigns.manage'), ('admin', 'campaigns.spend'),
    ('operations', 'campaigns.read'), ('operations', 'campaigns.manage'), ('operations', 'campaigns.spend'),
    ('sales', 'campaigns.read'), ('sales', 'campaigns.manage'),
    ('accountant', 'campaigns.read'),
    ('advertiser', 'campaigns.read'), ('advertiser', 'campaigns.manage'), ('advertiser', 'campaigns.spend')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM role_permission_codes rpc
JOIN roles r ON r.code = rpc.role_code
JOIN permissions p ON p.code = rpc.permission_code
ON CONFLICT DO NOTHING;
