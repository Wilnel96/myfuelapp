/*
  # Backfill Garage VAT Numbers to Existing Invoices
  
  1. Changes
    - Updates existing fuel_transaction_invoices with current garage VAT numbers
    - Only updates invoices where VAT number is empty or null
    - Uses garage_name to match with garages table
    
  2. Notes
    - This ensures all existing invoices show the current garage VAT numbers
    - New invoices will automatically include VAT numbers via the trigger
*/

-- Update existing invoices with garage VAT numbers from garages table
UPDATE fuel_transaction_invoices fti
SET garage_vat_number = COALESCE(g.vat_number, '')
FROM garages g
WHERE fti.garage_name = g.name
  AND (fti.garage_vat_number IS NULL OR fti.garage_vat_number = '');
