/*
  # Fix Vehicle Exceptions Foreign Key

  1. Changes
    - Drop the incorrect foreign key constraint pointing to vehicle_transactions
    - Add correct foreign key constraint pointing to fuel_transactions
    
  2. Security
    - No RLS changes needed
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE vehicle_exceptions 
DROP CONSTRAINT IF EXISTS vehicle_exceptions_transaction_id_fkey;

-- Add correct foreign key constraint pointing to fuel_transactions
ALTER TABLE vehicle_exceptions
ADD CONSTRAINT vehicle_exceptions_transaction_id_fkey 
FOREIGN KEY (transaction_id) 
REFERENCES fuel_transactions(id) 
ON DELETE SET NULL;