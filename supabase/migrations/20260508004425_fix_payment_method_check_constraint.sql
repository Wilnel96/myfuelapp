/*
  # Fix organizations payment_method check constraint

  The existing constraint only allowed 'Direct Debit' and 'Client Pay'.
  Steps:
  1. Drop the old constraint first
  2. Migrate any remaining 'Direct Debit' values to 'Debit Order'
  3. Add a new constraint covering all valid options: 'Debit Order', 'Client Pay', 'EFT'
*/

-- Drop old constraint first so the data update isn't blocked
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_payment_method_check;

-- Migrate any remaining 'Direct Debit' values to 'Debit Order'
UPDATE organizations
SET payment_method = 'Debit Order'
WHERE payment_method = 'Direct Debit';

-- Add updated constraint with all valid options
ALTER TABLE organizations
ADD CONSTRAINT organizations_payment_method_check
CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['Debit Order'::text, 'Client Pay'::text, 'EFT'::text]));
