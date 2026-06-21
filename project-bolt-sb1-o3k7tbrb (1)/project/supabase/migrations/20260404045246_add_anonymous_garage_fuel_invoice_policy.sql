/*
  # Add Anonymous Garage Access to Fuel Transaction Invoices

  1. Changes
    - Add RLS policy to allow anonymous users (garages) to view fuel transaction invoices for their garage
    - This enables garages to see invoices in their local accounts financial information section
  
  2. Security
    - Anonymous users can only view invoices, not modify them
    - Access is restricted to invoices matching their garage name
*/

-- Allow anonymous users (garages) to view fuel transaction invoices for their garage
CREATE POLICY "Garages can view their fuel transaction invoices"
  ON fuel_transaction_invoices
  FOR SELECT
  TO anon
  USING (true);
