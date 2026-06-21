/*
  # Add 'Both' payment option to organizations

  Allows organizations to use both Card Payment and Local Account payment methods simultaneously.

  1. Changes
    - Updates the check constraint on organizations.payment_option to include 'Both'
*/

DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'organizations'
    AND constraint_name = 'organizations_payment_option_check'
  ) THEN
    ALTER TABLE organizations DROP CONSTRAINT organizations_payment_option_check;
  END IF;
END $$;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_payment_option_check
  CHECK (payment_option IN ('Card Payment', 'Local Account', 'Both', 'Direct EFT', 'Debit Order'));
