/*
  # Fix Organization Users Infinite Recursion

  1. Problem
    - RLS policies on organization_users table query the same table to check permissions
    - This creates infinite recursion when reading/updating user records

  2. Solution
    - Create SECURITY DEFINER functions to check permissions without triggering RLS
    - Update all RLS policies to use these helper functions instead of direct queries

  3. Security
    - Functions are SECURITY DEFINER to bypass RLS during permission checks
    - Policies still enforce proper access control
    - Super admin bypass is maintained
*/

-- Drop existing policies first
DROP POLICY IF EXISTS "org_users_select_policy" ON organization_users;
DROP POLICY IF EXISTS "org_users_insert_policy" ON organization_users;
DROP POLICY IF EXISTS "org_users_update_policy" ON organization_users;
DROP POLICY IF EXISTS "org_users_delete_policy" ON organization_users;

-- Create helper function to check if user can manage users (bypasses RLS)
CREATE OR REPLACE FUNCTION can_manage_organization_users(org_id uuid)
RETURNS boolean AS $$
DECLARE
  result boolean;
BEGIN
  -- Check if user is super admin
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if user has can_manage_users permission in the organization
  SELECT EXISTS (
    SELECT 1
    FROM organization_users
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND can_manage_users = true
      AND is_active = true
  ) INTO result;

  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if user belongs to organization (bypasses RLS)
CREATE OR REPLACE FUNCTION belongs_to_organization(org_id uuid)
RETURNS boolean AS $$
DECLARE
  result boolean;
BEGIN
  -- Check if user is super admin
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if user belongs to the organization via profiles
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND organization_id = org_id
  ) INTO result;

  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies using helper functions
CREATE POLICY "org_users_select_policy"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    belongs_to_organization(organization_id)
  );

CREATE POLICY "org_users_insert_policy"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (
    can_manage_organization_users(organization_id)
  );

CREATE POLICY "org_users_update_policy"
  ON organization_users FOR UPDATE
  TO authenticated
  USING (
    can_manage_organization_users(organization_id)
  );

CREATE POLICY "org_users_delete_policy"
  ON organization_users FOR DELETE
  TO authenticated
  USING (
    can_manage_organization_users(organization_id)
  );
