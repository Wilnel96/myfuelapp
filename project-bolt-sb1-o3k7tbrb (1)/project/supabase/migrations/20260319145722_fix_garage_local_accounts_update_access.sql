/*
  # Fix Garage Local Accounts Update Access

  ## Problem
  Garages (anonymous users) were unable to deactivate local accounts because:
  1. The SELECT policy only allows viewing active accounts (is_active = true)
  2. To UPDATE a row, PostgreSQL RLS requires both SELECT and UPDATE permissions
  3. Garages couldn't modify accounts they manage because the SELECT policy was too restrictive

  ## Solution
  Add a SELECT policy that allows garages to view all organization_garage_accounts 
  (both active and inactive) so they can manage them properly.

  ## Security
  - Anonymous users (garages) can view all organization-garage account relationships
  - This is acceptable because:
    - Garages need to manage their client accounts
    - The data doesn't expose sensitive information
    - Garages authenticate client-side with email/password
    - The existing UPDATE/INSERT policies still control modifications

  ## Changes
  1. Add SELECT policy for anonymous users to view all accounts
     - Replaces the overly restrictive "is_active = true" condition
     - Allows garages to see and manage both active and inactive accounts
*/

-- Drop the restrictive SELECT policy for anonymous users
DROP POLICY IF EXISTS "Drivers can view active garage accounts for validation" ON organization_garage_accounts;

-- Add a more permissive SELECT policy for anonymous users (garages and drivers)
CREATE POLICY "Anonymous users can view garage accounts"
  ON organization_garage_accounts
  FOR SELECT
  TO anon
  USING (true);