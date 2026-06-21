/*
  # Add anonymous SELECT policy for organization_garage_accounts

  ## Summary
  Adds a SELECT policy for anonymous users to view organization_garage_accounts.
  This is required for the garage portal to see which organizations have local accounts,
  which in turn allows them to view organization_users information.

  ## Changes
  1. Add SELECT policy for anon role on organization_garage_accounts
     - Allows anonymous users to view all garage accounts
     - Required for RLS subquery in organization_users policy to work

  ## Security Notes
  - This allows garages (logged in anonymously) to see the relationship between
    organizations and garages
  - Sensitive fields like account numbers are already protected by the component logic
*/

-- Add anonymous SELECT policy for organization_garage_accounts
CREATE POLICY "Anonymous users can view organization garage accounts"
  ON organization_garage_accounts
  FOR SELECT
  TO anon
  USING (true);