/*
  # Fix Garage Users Organization Users Recursion

  1. Problem
    - The "Garage users can view client org users" policy creates infinite recursion
    - It queries organization_users while inside organization_users RLS policy
    - This causes "infinite recursion detected in policy" error

  2. Solution
    - Drop the problematic policy
    - Create a SECURITY DEFINER function to check if user can view org users
    - Recreate the policy using the helper function

  3. Security
    - Function bypasses RLS to check permissions
    - Only garage users can view client organization users
    - Client users can only view users in their own organization
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Garage users can view client org users" ON organization_users;

-- Create helper function to check if garage user can view client org users
CREATE OR REPLACE FUNCTION can_view_organization_users(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_is_garage_user boolean;
  v_user_org_id uuid;
BEGIN
  -- Get current user's role from profiles
  SELECT role, organization_id INTO v_user_role, v_user_org_id
  FROM profiles
  WHERE id = auth.uid();

  -- Super admin can view all
  IF v_user_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Check if user belongs to the target organization (regular users)
  IF v_user_org_id = target_org_id THEN
    RETURN true;
  END IF;

  -- Check if user is a garage user with access to this client organization
  -- Garage users can view org users for organizations that have accounts at their garage
  SELECT EXISTS (
    SELECT 1
    FROM organization_garage_accounts oga
    JOIN garages g ON g.id = oga.garage_id
    WHERE oga.organization_id = target_org_id
      AND g.organization_id = v_user_org_id
  ) INTO v_is_garage_user;

  RETURN COALESCE(v_is_garage_user, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION can_view_organization_users TO authenticated;

-- Update the org_users_select_policy to use the new function
DROP POLICY IF EXISTS "org_users_select_policy" ON organization_users;

CREATE POLICY "org_users_select_policy"
  ON organization_users
  FOR SELECT
  TO authenticated
  USING (
    can_view_organization_users(organization_id)
  );

-- Add comment
COMMENT ON FUNCTION can_view_organization_users IS
'Checks if user can view organization users. Supports super admins, org members, and garage users viewing client orgs.';
