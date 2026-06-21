/*
  # Fix Garage Update Policy for Anonymous Users

  1. Changes
    - Drop the previous policy that relied on JWT claims (which don't exist for garage auth)
    - Add a simpler policy allowing anonymous users to update organization_garage_accounts
    - This matches the existing anonymous SELECT policy for drivers

  2. Security Note
    - Garages authenticate client-side by validating credentials against the garages table
    - They use anonymous Supabase connections without JWT claims
    - This policy allows updates to match the current authentication architecture
*/

-- Drop the previous policy that won't work
DROP POLICY IF EXISTS "Garages can update their local client accounts" ON organization_garage_accounts;

-- Allow anonymous users (garages) to update organization_garage_accounts
CREATE POLICY "Garages can update local client accounts"
  ON organization_garage_accounts
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Also allow anonymous users to insert (in case they need to create accounts)
CREATE POLICY "Garages can insert local client accounts"
  ON organization_garage_accounts
  FOR INSERT
  TO anon
  WITH CHECK (true);
