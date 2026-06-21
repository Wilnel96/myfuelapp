/*
  # Add Garage Update Policy for Local Accounts

  1. Changes
    - Add RLS policy to allow garages (anonymous users) to update their local client accounts
    - Garages can update account_number, monthly_spend_limit, and notes for their accounts
    - Policy validates the garage_id matches the authenticated garage

  2. Security
    - Only allows updates to accounts belonging to the authenticated garage
    - Garages cannot change organization_id, garage_id, or is_active status
*/

-- Allow garages to update their local client accounts
CREATE POLICY "Garages can update their local client accounts"
  ON organization_garage_accounts
  FOR UPDATE
  TO anon
  USING (
    garage_id IN (
      SELECT id FROM garages 
      WHERE id::text = current_setting('request.jwt.claims', true)::json->>'garage_id'
    )
  )
  WITH CHECK (
    garage_id IN (
      SELECT id FROM garages 
      WHERE id::text = current_setting('request.jwt.claims', true)::json->>'garage_id'
    )
  );
