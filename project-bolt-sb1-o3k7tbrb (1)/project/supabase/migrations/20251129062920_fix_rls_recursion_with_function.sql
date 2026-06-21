/*
  # Fix RLS Recursion with Security Definer Function

  1. Problem
    - Policies on organization_users still cause recursion
    - Cannot query organization_users within its own policies
    
  2. Solution
    - Create a security definer function that bypasses RLS
    - Function checks if user can manage users in an organization
    - Policies call this function instead of querying the table directly
    
  3. Changes
    - Create helper function to check user permissions
    - Update all RLS policies to use the function
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users with permission can add users to their organization" ON organization_users;
DROP POLICY IF EXISTS "Users with permission can update users in their organization" ON organization_users;
DROP POLICY IF EXISTS "Users with permission can delete non-main users in their organization" ON organization_users;

-- Create a security definer function to check if user can manage users
CREATE OR REPLACE FUNCTION can_user_manage_organization_users(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is super admin
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is main user or has can_manage_users permission
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND is_active = true
    AND (is_main_user = true OR can_manage_users = true)
  );
END;
$$;

-- Create INSERT policy using the function
CREATE POLICY "Users with permission can add users to their organization"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (
    can_user_manage_organization_users(organization_id)
  );

-- Create UPDATE policy using the function
CREATE POLICY "Users with permission can update users in their organization"
  ON organization_users FOR UPDATE
  TO authenticated
  USING (
    can_user_manage_organization_users(organization_id)
  )
  WITH CHECK (
    can_user_manage_organization_users(organization_id)
  );

-- Create DELETE policy using the function (cannot delete main users)
CREATE POLICY "Users with permission can delete non-main users in their organization"
  ON organization_users FOR DELETE
  TO authenticated
  USING (
    NOT is_main_user
    AND can_user_manage_organization_users(organization_id)
  );