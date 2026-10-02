ALTER TABLE invoices ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_journal_entry_uq ON invoices (journal_entry_id);

INSERT INTO chart_of_accounts (id,code,name,account_type,normal_balance)
VALUES (gen_random_uuid(),'2300','Unapplied Customer Receipts','liability','credit')
ON CONFLICT (code) DO NOTHING;
