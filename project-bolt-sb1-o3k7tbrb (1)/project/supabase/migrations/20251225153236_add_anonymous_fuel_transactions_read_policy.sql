/*
  # Add Anonymous Access to Fuel Transactions for Drivers

  1. Changes
    - Add RLS policy to allow anonymous users (drivers) to read fuel transactions
    - This is required for the mobile fuel purchase flow to check spending limits

  2. Security
    - Allows reading fuel transactions for spending limit calculations
    - Required for driver mobile app functionality
*/

-- Drop policy if it exists
DROP POLICY IF EXISTS "fuel_transactions_select_policy_anon" ON fuel_transactions;

-- Allow anonymous users to read fuel transactions (needed for spending limit checks)
CREATE POLICY "fuel_transactions_select_policy_anon"
  ON fuel_transactions
  FOR SELECT
  TO anon
  USING (true);
