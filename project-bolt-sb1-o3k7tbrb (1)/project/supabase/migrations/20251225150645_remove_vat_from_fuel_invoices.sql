/*
  # Remove VAT from Fuel Transaction Invoices

  This migration updates the fuel transaction invoices system to remove VAT calculations,
  as fuel is not subject to VAT.

  1. Changes to fuel_transaction_invoices table
    - Make vat_rate nullable (default NULL)
    - Make vat_amount nullable (default NULL)
    - Remove subtotal column (no longer needed)
    - total_amount remains the actual fuel cost

  2. Notes
    - Existing invoices will retain their VAT data for historical purposes
    - New invoices will not include VAT calculations
*/

-- Make VAT fields nullable and update defaults
ALTER TABLE fuel_transaction_invoices 
  ALTER COLUMN vat_rate DROP NOT NULL,
  ALTER COLUMN vat_rate DROP DEFAULT,
  ALTER COLUMN vat_rate SET DEFAULT NULL;

ALTER TABLE fuel_transaction_invoices 
  ALTER COLUMN vat_amount DROP NOT NULL,
  ALTER COLUMN vat_amount SET DEFAULT NULL;

-- Drop the subtotal column constraint and make it nullable
ALTER TABLE fuel_transaction_invoices 
  ALTER COLUMN subtotal DROP NOT NULL,
  ALTER COLUMN subtotal SET DEFAULT NULL;

-- Update the check constraint on vat_rate to allow NULL
ALTER TABLE fuel_transaction_invoices 
  DROP CONSTRAINT IF EXISTS fuel_transaction_invoices_vat_rate_check;

ALTER TABLE fuel_transaction_invoices 
  ADD CONSTRAINT fuel_transaction_invoices_vat_rate_check 
  CHECK (vat_rate IS NULL OR vat_rate >= 0);

-- Update the check constraint on vat_amount to allow NULL
ALTER TABLE fuel_transaction_invoices 
  DROP CONSTRAINT IF EXISTS fuel_transaction_invoices_vat_amount_check;

ALTER TABLE fuel_transaction_invoices 
  ADD CONSTRAINT fuel_transaction_invoices_vat_amount_check 
  CHECK (vat_amount IS NULL OR vat_amount >= 0);

-- Update the check constraint on subtotal to allow NULL
ALTER TABLE fuel_transaction_invoices 
  DROP CONSTRAINT IF EXISTS fuel_transaction_invoices_subtotal_check;

ALTER TABLE fuel_transaction_invoices 
  ADD CONSTRAINT fuel_transaction_invoices_subtotal_check 
  CHECK (subtotal IS NULL OR subtotal >= 0);
