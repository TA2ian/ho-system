CREATE TABLE IF NOT EXISTS accounting_periods (
  id uuid PRIMARY KEY,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid REFERENCES users(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_periods_range_ck CHECK (period_end >= period_start),
  UNIQUE (period_start)
);
CREATE INDEX IF NOT EXISTS accounting_periods_status_idx ON accounting_periods (status);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_id uuid REFERENCES chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chart_of_accounts_type_idx ON chart_of_accounts (account_type);
CREATE INDEX IF NOT EXISTS chart_of_accounts_parent_idx ON chart_of_accounts (parent_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY,
  entry_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'posted')),
  entry_date date NOT NULL,
  accounting_period_id uuid NOT NULL REFERENCES accounting_periods(id),
  currency_code text NOT NULL REFERENCES currencies(code),
  exchange_rate_to_base numeric(24,10) NOT NULL CHECK (exchange_rate_to_base > 0),
  base_currency_code text NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  description text NOT NULL,
  source_type text,
  source_id text,
  source_event_key text UNIQUE,
  reverses_entry_id uuid UNIQUE REFERENCES journal_entries(id),
  created_by uuid NOT NULL REFERENCES users(id),
  posted_by uuid REFERENCES users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_entries_date_idx ON journal_entries (entry_date);
CREATE INDEX IF NOT EXISTS journal_entries_status_idx ON journal_entries (status);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx ON journal_entries (source_type, source_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id),
  line_number integer NOT NULL,
  account_id uuid NOT NULL REFERENCES chart_of_accounts(id),
  currency_code text NOT NULL REFERENCES currencies(code),
  debit_amount numeric(24,10) NOT NULL DEFAULT 0,
  credit_amount numeric(24,10) NOT NULL DEFAULT 0,
  base_debit_amount numeric(24,10) NOT NULL DEFAULT 0,
  base_credit_amount numeric(24,10) NOT NULL DEFAULT 0,
  description text,
  customer_id uuid REFERENCES customers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_entry_id, line_number),
  CONSTRAINT journal_lines_side_ck CHECK (
    (debit_amount > 0 AND credit_amount = 0)
    OR (credit_amount > 0 AND debit_amount = 0)
  ),
  CONSTRAINT journal_lines_base_side_ck CHECK (
    (base_debit_amount > 0 AND base_credit_amount = 0)
    OR (base_credit_amount > 0 AND base_debit_amount = 0)
  )
);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS journal_lines_customer_idx ON journal_lines (customer_id);

CREATE OR REPLACE FUNCTION prevent_posted_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    IF TG_OP = 'DELETE' AND OLD.status = 'posted' THEN
      RAISE EXCEPTION 'posted journal entries are immutable';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'posted' THEN
      RAISE EXCEPTION 'posted journal entries are immutable';
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      IF EXISTS (SELECT 1 FROM journal_entries WHERE id = OLD.journal_entry_id AND status = 'posted') THEN
        RAISE EXCEPTION 'posted journal lines are immutable';
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      IF EXISTS (SELECT 1 FROM journal_entries WHERE id = NEW.journal_entry_id AND status = 'posted') THEN
        RAISE EXCEPTION 'cannot add lines to a posted journal entry';
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS journal_entries_immutable ON journal_entries;
CREATE TRIGGER journal_entries_immutable
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_mutation();

DROP TRIGGER IF EXISTS journal_lines_immutable ON journal_lines;
CREATE TRIGGER journal_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_mutation();

INSERT INTO accounting_periods (id, period_start, period_end, status, created_by)
SELECT gen_random_uuid(), make_date(2026, m, 1), (make_date(2026, m, 1) + INTERVAL '1 month - 1 day')::date, 'open',
       (SELECT id FROM users ORDER BY created_at LIMIT 1)
FROM generate_series(1,12) AS m
WHERE NOT EXISTS (SELECT 1 FROM accounting_periods WHERE period_start = make_date(2026, m, 1));

WITH seed(code,name,account_type,normal_balance) AS (
  VALUES
    ('1000','Cash','asset','debit'),
    ('1010','Sham Cash','asset','debit'),
    ('1100','Accounts Receivable','asset','debit'),
    ('1200','Inventory','asset','debit'),
    ('1300','Prepaid Expenses','asset','debit'),
    ('2000','Accounts Payable','liability','credit'),
    ('2100','Advertiser Partner Payable','liability','credit'),
    ('2200','Employee Compensation Payable','liability','credit'),
    ('3000','Owner Equity','equity','credit'),
    ('4000','Product Sales Revenue','revenue','credit'),
    ('4100','Service Revenue','revenue','credit'),
    ('4200','Advertising Management Revenue','revenue','credit'),
    ('5000','Cost of Goods Sold','expense','debit'),
    ('5100','Advertising Expense','expense','debit'),
    ('5200','Employee Compensation Expense','expense','debit'),
    ('5300','Operating Expenses','expense','debit')
)
INSERT INTO chart_of_accounts (id,code,name,account_type,normal_balance)
SELECT gen_random_uuid(),code,name,account_type,normal_balance FROM seed
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (id, code, description)
VALUES
  (gen_random_uuid(), 'accounting.periods.manage', 'Open and close accounting periods'),
  (gen_random_uuid(), 'accounting.accounts.manage', 'Manage chart of accounts'),
  (gen_random_uuid(), 'accounting.journal.read', 'Read journal entries'),
  (gen_random_uuid(), 'accounting.journal.post', 'Create and post journal entries')
ON CONFLICT (code) DO NOTHING;

WITH role_permission_codes(role_code, permission_code) AS (
  VALUES
    ('owner','accounting.periods.manage'),('owner','accounting.accounts.manage'),('owner','accounting.journal.read'),('owner','accounting.journal.post'),
    ('admin','accounting.periods.manage'),('admin','accounting.accounts.manage'),('admin','accounting.journal.read'),('admin','accounting.journal.post'),
    ('accountant','accounting.periods.manage'),('accountant','accounting.accounts.manage'),('accountant','accounting.journal.read'),('accountant','accounting.journal.post'),
    ('operations','accounting.journal.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id,p.id FROM role_permission_codes rpc
JOIN roles r ON r.code=rpc.role_code
JOIN permissions p ON p.code=rpc.permission_code
ON CONFLICT DO NOTHING;
