/*
  # Add Bank Details to Organizations

  1. Changes
    - Add bank details columns to organizations table for debit order processing
      - `bank_name` - Name of the bank (e.g., Standard Bank, FNB)
      - `bank_account_holder` - Name on the bank account
      - `bank_account_number` - Bank account number
      - `bank_branch_code` - Bank branch code
      - `bank_account_type` - Type of account (cheque, savings, current)
  
  2. Notes
    - These fields are used for client organizations to process monthly debit orders
    - All fields are nullable as not all organizations may require debit orders
    - Bank details should be handled securely and only accessible to authorized users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_name TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_account_holder'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_account_holder TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_account_number'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_account_number TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_branch_code'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_branch_code TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_account_type'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_account_type TEXT DEFAULT NULL;
  END IF;
END $$;
