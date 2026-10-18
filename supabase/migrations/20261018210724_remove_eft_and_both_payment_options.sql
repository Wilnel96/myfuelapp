-- Remove "EFT Payment" and "Both" from payment_option check constraints.
-- Only "Card Payment" and "Local Account" are valid payment methods now.

-- Step 1: Migrate existing data BEFORE changing constraints
UPDATE organizations SET payment_option = 'Local Account' WHERE payment_option IN ('Both', 'EFT Payment');
UPDATE fuel_transaction_invoices SET payment_option = 'Local Account' WHERE payment_option IN ('Both', 'EFT Payment');
UPDATE invoices SET payment_option = 'Local Account' WHERE payment_option IN ('Both', 'EFT Payment');

-- Step 2: Update check constraints
ALTER TABLE fuel_transaction_invoices
  DROP CONSTRAINT IF EXISTS fuel_transaction_invoices_payment_option_check;
ALTER TABLE fuel_transaction_invoices
  ADD CONSTRAINT fuel_transaction_invoices_payment_option_check
  CHECK (payment_option = ANY (ARRAY['Card Payment'::text, 'Local Account'::text]));

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_option_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_option_check
  CHECK (payment_option = ANY (ARRAY['Card Payment'::text, 'Local Account'::text]));

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_payment_option_check;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_payment_option_check
  CHECK (payment_option = ANY (ARRAY['Card Payment'::text, 'Local Account'::text]));
