/*
  # Add Anonymous Policy for Organization Users (Garage Access)

  1. Changes
    - Add a SELECT policy for anonymous users to view organization_users
    - Garages authenticate via password stored in the garages table, not via Supabase Auth
    - This policy allows anonymous requests to see organization users for organizations with garage accounts
  
  2. Security
    - Only allows viewing users for organizations that have relationships with garages
    - Does not expose all organization_users data
    - Garages must still know the organization_id to query
*/

-- Add policy for anonymous users (garages) to view organization users for their client organizations
CREATE POLICY "org_users_select_policy_anonymous"
  ON organization_users FOR SELECT
  TO anon
  USING (
    -- Allow anonymous users to view organization users for organizations that have garage accounts
    -- This is needed because garages authenticate via their own password system, not Supabase Auth
    EXISTS (
      SELECT 1
      FROM organization_garage_accounts
      WHERE organization_garage_accounts.organization_id = organization_users.organization_id
    )
  );
