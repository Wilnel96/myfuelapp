/*
  # Restrict Fuel Transaction Creation to Drivers Only

  1. Changes
    - Drop the existing fuel_transactions_insert_policy
    - Create new policy that only allows drivers to create transactions
    - Driver must be creating transaction for themselves and their organization
  
  2. Security
    - Only authenticated drivers can create fuel transactions
    - Driver can only create transactions with their own driver_id
    - Transaction must be for the driver's organization
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "fuel_transactions_insert_policy" ON fuel_transactions;

-- Create new restrictive policy for drivers only
CREATE POLICY "fuel_transactions_insert_policy"
  ON fuel_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a driver
    EXISTS (
      SELECT 1 
      FROM drivers d
      WHERE d.user_id = auth.uid()
      AND d.id = fuel_transactions.driver_id
      AND d.organization_id = fuel_transactions.organization_id
      AND d.status = 'active'
    )
  );
