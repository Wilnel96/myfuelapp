/*
  # Add UPDATE Policy for Organization Users on Garage Accounts

  ## Problem
  Organization users (authenticated) can view their garage accounts but cannot update them.
  This causes "new row violates row-level security policy" errors when trying to 
  deactivate/activate accounts or update account details.

  ## Changes
  1. Add UPDATE policy for authenticated organization users
     - Allows users to update garage accounts for their own organization
     - Requires user to be a member of the organization (via organization_users or profiles)
     - Super admins already have full access via existing ALL policy

  ## Security
  - Restricts updates to only the user's own organization's garage accounts
  - Prevents unauthorized cross-organization modifications
*/

-- Add UPDATE policy for organization users to manage their garage accounts
CREATE POLICY "Organization users can update their garage accounts"
  ON organization_garage_accounts
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be part of the organization (via organization_users)
    organization_id IN (
      SELECT organization_users.organization_id 
      FROM organization_users
      WHERE organization_users.user_id = auth.uid()
    )
    OR
    -- Or user is linked to org via profiles table
    organization_id IN (
      SELECT profiles.organization_id 
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    -- Ensure the organization_id doesn't change to a different org
    organization_id IN (
      SELECT organization_users.organization_id 
      FROM organization_users
      WHERE organization_users.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT profiles.organization_id 
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Add INSERT policy for organization users to create garage accounts
CREATE POLICY "Organization users can insert their garage accounts"
  ON organization_garage_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be part of the organization they're creating an account for
    organization_id IN (
      SELECT organization_users.organization_id 
      FROM organization_users
      WHERE organization_users.user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT profiles.organization_id 
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );