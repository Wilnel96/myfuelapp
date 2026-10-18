/*
# Fix fuel_transaction_invoices payment_option check constraint

## Problem
The `fuel_transaction_invoices` table has a CHECK constraint on
`payment_option` that only allows 'EFT Payment', 'Card Payment', and
'Local Account'. But organizations can also have 'Both' as their payment
option. When the auto-invoice trigger copies the org's payment_option
into the invoice, it fails the constraint and the invoice is never created.

## Fix
Drop the old constraint and create a new one that also allows 'Both'.
*/

ALTER TABLE fuel_transaction_invoices
  DROP CONSTRAINT IF EXISTS fuel_transaction_invoices_payment_option_check;

ALTER TABLE fuel_transaction_invoices
  ADD CONSTRAINT fuel_transaction_invoices_payment_option_check
  CHECK (payment_option = ANY (ARRAY['EFT Payment'::text, 'Card Payment'::text, 'Local Account'::text, 'Both'::text]));
