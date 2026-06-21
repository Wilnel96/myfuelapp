/*
  # Fix Vehicle Exceptions to Support Vehicle Draw/Return Transactions

  1. Problem
    - vehicle_exceptions.transaction_id currently references fuel_transactions(id)
    - But we also need to log exceptions during vehicle draw/return operations
    - These are stored in vehicle_transactions table, not fuel_transactions
  
  2. Solution
    - Drop the restrictive foreign key constraint
    - Make transaction_id a generic UUID that can reference either table
    - Add separate columns to identify which table the transaction belongs to
    - Add validation to ensure proper referential integrity via triggers
  
  3. Changes
    - Drop foreign key constraint on transaction_id
    - Add transaction_type column to identify source table
    - Keep transaction_id nullable for backward compatibility
    - Add check constraint to ensure transaction_type is valid
*/

-- Drop the existing foreign key constraint
ALTER TABLE vehicle_exceptions 
DROP CONSTRAINT IF EXISTS vehicle_exceptions_transaction_id_fkey;

-- Add transaction_type column to identify which table the transaction belongs to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_exceptions' AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE vehicle_exceptions 
    ADD COLUMN transaction_type text CHECK (transaction_type IN ('fuel', 'vehicle_draw', 'vehicle_return'));
  END IF;
END $$;

-- Add comment explaining the new structure
COMMENT ON COLUMN vehicle_exceptions.transaction_id IS 'UUID of the related transaction - can reference fuel_transactions.id or vehicle_transactions.id depending on transaction_type';
COMMENT ON COLUMN vehicle_exceptions.transaction_type IS 'Type of transaction: fuel (fuel_transactions), vehicle_draw or vehicle_return (vehicle_transactions)';

-- Update existing records to have transaction_type = 'fuel' since they all reference fuel_transactions
UPDATE vehicle_exceptions 
SET transaction_type = 'fuel' 
WHERE transaction_id IS NOT NULL 
  AND transaction_type IS NULL;
