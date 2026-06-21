/*
  # Add Garage VAT Number to Fuel Transaction Invoices

  1. Changes
    - Add `garage_vat_number` column to fuel_transaction_invoices table
    - VAT number will be captured at time of transaction for tax compliance
    - Will be displayed on fuel transaction invoices

  2. Security
    - No RLS changes needed (existing policies apply)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transaction_invoices' AND column_name = 'garage_vat_number'
  ) THEN
    ALTER TABLE fuel_transaction_invoices ADD COLUMN garage_vat_number text DEFAULT '';
  END IF;
END $$;
