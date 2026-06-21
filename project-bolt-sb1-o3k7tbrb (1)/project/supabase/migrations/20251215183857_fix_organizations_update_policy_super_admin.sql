/*
  # Fix Organizations Update Policy for Super Admin
  
  ## Problem
  The organizations update policy doesn't allow super_admin users to update client organizations.
  
  ## Solution
  Drop and recreate the policy with super_admin bypass, allowing:
  1. Users to update their own organization
  2. Super admins to update any organization
  
  ## Changes
  - Drop existing organizations_update_policy
  - Create new policy with super_admin role check
*/

DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;

CREATE POLICY "organizations_update_policy" ON organizations 
FOR UPDATE TO authenticated 
USING (
  id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
)
WITH CHECK (
  id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);
