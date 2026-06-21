/*
  # Fix Organizations Insert Policy with Security Definer Function
  
  ## Problem
  Complex subqueries in RLS policies can sometimes cause issues with
  policy evaluation. The current INSERT policy uses JOINs and EXISTS
  subqueries which might be failing silently.
  
  ## Solution
  Create a SECURITY DEFINER function that bypasses RLS to check if
  a user belongs to a management organization. Then use this function
  in a simpler RLS policy.
  
  ## Changes
  1. Create `is_management_org_user()` function with SECURITY DEFINER
  2. Update the INSERT policy to use this function
  3. Simplify the policy logic
  
  ## Security
  - SECURITY DEFINER function is safe because it only reads data
  - Function has explicit search_path set
  - Policy still maintains all security checks
*/

-- Create function to check if user belongs to management org
CREATE OR REPLACE FUNCTION public.is_management_org_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_management_user boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid()
      AND o.is_management_org = true
      AND o.organization_type = 'management'
  ) INTO v_is_management_user;
  
  RETURN COALESCE(v_is_management_user, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_management_org_user() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.is_management_org_user() IS 
  'Checks if the current user belongs to a management organization. Used for RLS policies.';

-- Drop the old policy
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;

-- Create new simplified policy using the function
CREATE POLICY "organizations_insert_policy"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow super admins to create any organization
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- Allow management org users to create client organizations only
    (
      organization_type = 'client' 
      AND is_management_org = false
      AND public.is_management_org_user()
    )
  );

-- Add comment documenting the policy
COMMENT ON POLICY "organizations_insert_policy" ON organizations IS 
  'Allows super admins to create any organization. Allows management organization users to create client organizations only. Uses security definer function for reliable permission checking.';
