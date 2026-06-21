/*
  # Add Account Limit to Organization-Garage Accounts

  1. Changes
    - Add `account_limit` column to `organization_garage_accounts` table
      - Stores the maximum amount the client can owe on their local account
      - Used by garages to control credit limits for each client
      - Nullable to allow unlimited accounts or accounts where limit is not set
      - Stored as numeric for precise financial calculations

  2. Migration Strategy
    - Column is nullable to allow existing records
    - Garages can set/update limits as needed
    - When null, no limit is enforced (unlimited or managed externally)

  3. Security
    - No RLS changes needed - existing policies cover this column
*/

-- Add account_limit to organization_garage_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_garage_accounts' AND column_name = 'account_limit'
  ) THEN
    ALTER TABLE organization_garage_accounts ADD COLUMN account_limit numeric(10, 2);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN organization_garage_accounts.account_limit IS 'Maximum amount the client can owe on their local account. NULL means no limit or limit managed externally.';