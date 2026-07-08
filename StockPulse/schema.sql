-- Run this in your Supabase SQL Editor

CREATE TABLE users (
  email text PRIMARY KEY,
  name text NOT NULL,
  password text NOT NULL,
--change if you want to change the default e token value
--ALTER TABLE users ALTER COLUMN etokens SET DEFAULT 'new_value';
--ALTER TABLE users ALTER COLUMN e_tokens SET DEFAULT 'new_value';
  etokens numeric DEFAULT 10000,       
  e_tokens numeric DEFAULT 10000,
  portfolio jsonb DEFAULT '[]'::jsonb,
  options jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE trades (
  _id text PRIMARY KEY,
  email text REFERENCES users(email) ON DELETE CASCADE,
  action text,
  symbol text,
  amount numeric,
  price numeric,
  total numeric,
  timestamp text
);

CREATE TABLE option_trades (
  _id text PRIMARY KEY,
  email text REFERENCES users(email) ON DELETE CASCADE,
  action text,
  "contractSymbol" text,
  "underlyingSymbol" text,
  "optionType" text,
  strike numeric,
  expiration numeric,
  lots numeric,
  premium numeric,
  total numeric,
  timestamp text
);

-- Migration helper for existing Supabase schema with old case-sensitive eTokens column:
--
-- ALTER TABLE users RENAME COLUMN "eTokens" TO etokens;
-- UPDATE users SET e_tokens = etokens WHERE e_tokens IS NULL;
-- COMMENT ON COLUMN users.etokens IS 'Legacy camelCase field normalized for Supabase/PostgREST';
--
-- If eTokens does not exist and you need to add:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS etokens numeric DEFAULT 10000;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS e_tokens numeric DEFAULT 10000;

-- App config table (used for admin global favorites broadcast etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb
);

-- Seed empty global favorites list
INSERT INTO app_config (key, value)
VALUES ('global_favorites', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Dedicated Supabase database table (email_otps) to store codes and timestamps
CREATE TABLE IF NOT EXISTS email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

