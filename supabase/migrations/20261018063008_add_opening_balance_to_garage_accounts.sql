/*
# Add opening_balance to organization_garage_accounts

1. Changes
  - Adds `opening_balance` (numeric, default 0) to `organization_garage_accounts`.
  - This stores the balance a client brings from their previous accounting system
    when a garage onboards them. The first statement generated for that account
    will use this value as its opening balance instead of defaulting to 0.
  - Adds `opening_balance_set_at` (timestamptz) to record when the opening
    balance was configured, for audit purposes.

2. Security
  - No RLS policy changes. Existing policies on organization_garage_accounts
    already control who can read/update the row, so the new columns inherit
    that protection.
*/

ALTER TABLE organization_garage_accounts
  ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0;

ALTER TABLE organization_garage_accounts
  ADD COLUMN IF NOT EXISTS opening_balance_set_at timestamptz;