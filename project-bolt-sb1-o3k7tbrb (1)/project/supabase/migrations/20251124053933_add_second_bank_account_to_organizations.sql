/*
  # Add Second Bank Account to Organizations

  1. Changes
    - Add second bank account details columns to organizations table
      - `bank_name_2` - Name of the second bank (e.g., Nedbank, ABSA)
      - `bank_account_holder_2` - Name on the second bank account
      - `bank_account_number_2` - Second bank account number
      - `bank_branch_code_2` - Second bank branch code
      - `bank_account_type_2` - Type of second account (cheque, savings, current)
  
  2. Notes
    - These fields allow organizations to maintain two separate bank accounts
    - All fields are nullable as organizations may only need one bank account
    - Bank details should be handled securely and only accessible to authorized users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_name_2'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_name_2 TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_account_holder_2'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_account_holder_2 TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_account_number_2'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_account_number_2 TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_branch_code_2'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_branch_code_2 TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'bank_account_type_2'
  ) THEN
    ALTER TABLE organizations ADD COLUMN bank_account_type_2 TEXT DEFAULT NULL;
  END IF;
END $$;