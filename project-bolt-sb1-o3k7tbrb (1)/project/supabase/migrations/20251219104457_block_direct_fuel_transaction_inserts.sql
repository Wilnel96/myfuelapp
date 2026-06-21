/*
  # Block Direct Fuel Transaction Inserts

  1. Changes
    - Drop existing insert policy for fuel_transactions
    - Create new policy that blocks all direct inserts from clients
    - Only the edge function with service role key can create fuel transactions
  
  2. Security
    - No authenticated users can directly insert fuel transactions
    - All fuel transactions must go through the create-fuel-transaction edge function
    - Edge function validates driver session and organization ownership
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "fuel_transactions_insert_policy" ON fuel_transactions;

-- Create policy that blocks all direct inserts
-- The edge function uses service role key which bypasses RLS
CREATE POLICY "fuel_transactions_no_direct_insert"
  ON fuel_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
