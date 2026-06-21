/*
  # Rename account_limit to monthly_spend_limit

  1. Changes
    - Rename `account_limit` column to `monthly_spend_limit` in `organization_garage_accounts` table
      - This clarifies that the limit is a monthly spending cap, not a total credit limit
      - Works the same as the spending limits set when a client organization is created
      - Resets at the beginning of each month
      - Helps garages manage client spending on local accounts

  2. Documentation
    - Updated column comment to clearly explain this is a monthly limit
    - When null, no monthly limit is enforced

  3. Data Safety
    - Using ALTER COLUMN RENAME which preserves all existing data
    - No data loss or transformation needed
*/

-- Rename the column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_garage_accounts' AND column_name = 'account_limit'
  ) THEN
    ALTER TABLE organization_garage_accounts 
      RENAME COLUMN account_limit TO monthly_spend_limit;
  END IF;
END $$;

-- Update comment for documentation
COMMENT ON COLUMN organization_garage_accounts.monthly_spend_limit IS 'Maximum amount the client can spend per month on their local account. NULL means no monthly limit. Resets at the start of each month.';