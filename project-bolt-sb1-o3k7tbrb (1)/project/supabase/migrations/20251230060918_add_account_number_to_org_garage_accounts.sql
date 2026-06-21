/*
  # Add Account Number to Organization-Garage Relationships
  
  1. Changes
    - Add `account_number` column to `organization_garage_accounts` table
      - Stores the specific account number the client has with each garage
      - Each garage has its own till/accounting system
      - Different account number for each organization-garage relationship
      - Used by driver mobile app to retrieve correct account for refueling
  
  2. Migration Strategy
    - Column is nullable to allow existing records
    - Can be populated as clients provide their account numbers per garage
    - Remove deprecated `local_account_number` from organizations table (no longer needed)
  
  3. Security
    - No RLS changes needed - existing policies cover this column
    - Account numbers are not encrypted (business requirement)
    - Driver PIN verification required to access (handled in application logic)
*/

-- Add account_number to organization_garage_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_garage_accounts' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE organization_garage_accounts ADD COLUMN account_number text;
  END IF;
END $$;

-- Remove deprecated local_account_number from organizations
-- This is no longer needed since each garage has its own account number
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'local_account_number'
  ) THEN
    ALTER TABLE organizations DROP COLUMN local_account_number;
  END IF;
END $$;
