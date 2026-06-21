/*
  # Add VAT Number to Garages

  1. Changes
    - Add `vat_number` column to garages table
    - VAT number is required for South African businesses
    - Will be displayed on fuel transaction invoices

  2. Security
    - No RLS changes needed (existing policies apply)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'vat_number'
  ) THEN
    ALTER TABLE garages ADD COLUMN vat_number text DEFAULT '';
  END IF;
END $$;
