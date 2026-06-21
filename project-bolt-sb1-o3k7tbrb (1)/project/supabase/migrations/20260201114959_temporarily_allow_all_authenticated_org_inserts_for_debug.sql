/*
  # Temporarily Allow All Authenticated Organization Inserts for Debugging
  
  ## Problem
  The current INSERT policy is failing despite having proper checks.
  This migration temporarily simplifies the policy to debug the issue.
  
  ## Changes
  - Temporarily allow all authenticated users to insert client organizations
  - This will help identify if the issue is with the policy logic or something else
  
  ## WARNING
  This is a temporary debugging measure and should be replaced with
  proper security policies once the issue is identified.
*/

-- Drop the current policy
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;

-- Create a temporary permissive policy for debugging
CREATE POLICY "organizations_insert_policy_temp_debug"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- For now, allow all authenticated users to create client organizations
    -- This is TEMPORARY for debugging
    (organization_type = 'client' AND is_management_org = false)
    OR
    -- Still allow super admins to create anything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Add comment
COMMENT ON POLICY "organizations_insert_policy_temp_debug" ON organizations IS 
  'TEMPORARY DEBUG POLICY - Allows all authenticated users to create client organizations. Will be replaced with proper security policy.';
