/*
  # Fix Drivers Infinite Recursion

  1. Problem
    - The SELECT policy on drivers table has infinite recursion
    - It queries the drivers table within its own policy check
    - This causes "infinite recursion detected" error

  2. Solution
    - Drop the problematic SELECT policy
    - Create a new policy that avoids self-reference
    - Allow drivers to view their own record using user_id directly
    - Maintain organization and parent organization access
    - Maintain super admin access

  3. Changes
    - Drop existing "Authenticated users can view drivers" policy
    - Create new policy without recursive subquery
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Authenticated users can view drivers" ON drivers;

-- Create new policy without recursion
CREATE POLICY "Authenticated users can view drivers"
  ON drivers
  FOR SELECT
  TO authenticated
  USING (
    -- User's own organization drivers
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
    OR
    -- Driver's own record (direct check without subquery on drivers)
    user_id = auth.uid()
    OR
    -- Child organization drivers (parent org can see children)
    organization_id IN (
      SELECT id 
      FROM organizations 
      WHERE parent_org_id IN (
        SELECT organization_id 
        FROM profiles 
        WHERE id = auth.uid()
      )
    )
    OR
    -- Super admin can see all
    EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );
