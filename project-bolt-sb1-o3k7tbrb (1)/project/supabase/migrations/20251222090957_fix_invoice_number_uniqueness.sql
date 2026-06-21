/*
  # Fix Invoice Number Uniqueness

  1. Changes
    - Remove global unique constraint on invoice_number
    - Add composite unique constraint on (organization_id, invoice_number)
    - This allows each organization to have their own invoice numbering sequence

  2. Notes
    - Invoice numbers should be unique per organization, not globally
    - This allows multiple organizations to have INV-000001, INV-000002, etc.
*/

-- Drop the global unique constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

-- Add composite unique constraint per organization
ALTER TABLE invoices ADD CONSTRAINT invoices_org_invoice_number_unique 
  UNIQUE (organization_id, invoice_number);
