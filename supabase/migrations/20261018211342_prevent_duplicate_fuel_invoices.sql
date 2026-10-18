-- Add unique constraint to prevent duplicate invoices per fuel transaction
-- First, remove the orphaned duplicate invoice (the one NOT linked to the transaction)
DELETE FROM fuel_transaction_invoices
WHERE id = '24112e19-9036-40d7-bf83-bc8623a44655';

-- Add unique constraint so each fuel transaction can only have one invoice
ALTER TABLE fuel_transaction_invoices
  ADD CONSTRAINT fuel_transaction_invoices_fuel_transaction_id_key
  UNIQUE (fuel_transaction_id);
