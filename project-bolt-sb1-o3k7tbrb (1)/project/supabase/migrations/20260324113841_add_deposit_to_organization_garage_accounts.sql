/*
  # Add Deposit Field to Organization Garage Accounts

  1. Changes
    - Add `deposit_amount` column to `organization_garage_accounts` table
      - Type: numeric(10,2) to store monetary values with 2 decimal places
      - Default: 0.00 (no deposit required by default)
      - Nullable: false
    
  2. Purpose
    - Allow garages to specify a deposit amount required to open a local account
    - Track deposit amounts paid by organizations to garages
*/

-- Add deposit_amount column to organization_garage_accounts
ALTER TABLE organization_garage_accounts
ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) NOT NULL DEFAULT 0.00;

-- Add comment for documentation
COMMENT ON COLUMN organization_garage_accounts.deposit_amount IS 'Deposit amount required by the garage to open/maintain the local account';