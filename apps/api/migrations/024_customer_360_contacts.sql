CREATE TABLE customer_phones (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  phone text NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_phones_customer_idx ON customer_phones(customer_id);
CREATE UNIQUE INDEX customer_phones_identity_uq ON customer_phones(customer_id, phone);
CREATE UNIQUE INDEX customer_phones_primary_uq ON customer_phones(customer_id) WHERE is_primary;

CREATE TABLE customer_addresses (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON customer_addresses(customer_id);
CREATE UNIQUE INDEX customer_addresses_primary_uq ON customer_addresses(customer_id) WHERE is_primary;

CREATE TABLE customer_social_accounts (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform text NOT NULL,
  account_identifier text NOT NULL,
  profile_url text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_social_accounts_customer_idx ON customer_social_accounts(customer_id);
CREATE UNIQUE INDEX customer_social_accounts_identity_uq
  ON customer_social_accounts(customer_id, platform, account_identifier);
CREATE UNIQUE INDEX customer_social_accounts_primary_platform_uq
  ON customer_social_accounts(customer_id, platform) WHERE is_primary;
