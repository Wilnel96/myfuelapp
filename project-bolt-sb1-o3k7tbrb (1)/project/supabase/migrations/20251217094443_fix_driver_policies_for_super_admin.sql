/*
  # Fix Driver Policies for Super Admin Access
  
  ## Summary
  Adds super_admin bypass to driver RLS policies so super admins can view and manage all drivers across all organizations.
  
  ## Changes Made
  - Updated SELECT policy to allow super_admins to view all drivers
  - Updated INSERT policy to allow super_admins to add drivers to any organization
  - Updated UPDATE policy to allow super_admins to update any driver
  - Updated DELETE policy to allow super_admins to delete any driver
  - Regular users still restricted to their own organization and child organizations
  
  ## Security Notes
  - Super admins (role = 'super_admin') can access all driver data
  - Regular users restricted to their organization hierarchy
*/

-- Drop existing driver policies
DROP POLICY IF EXISTS "Users can view drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Users can insert drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Users can update drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Users can delete drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Authenticated users can view drivers" ON drivers;

-- Create new SELECT policy with super admin bypass
CREATE POLICY "Authenticated users can view drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all drivers
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view drivers in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Create new INSERT policy with super admin bypass
CREATE POLICY "Authenticated users can insert drivers"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert drivers anywhere
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can insert drivers in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Create new UPDATE policy with super admin bypass
CREATE POLICY "Authenticated users can update drivers"
  ON drivers FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update any driver
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can update drivers in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    -- Super admins can update to any org
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can only update within their org hierarchy
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Create new DELETE policy with super admin bypass
CREATE POLICY "Authenticated users can delete drivers"
  ON drivers FOR DELETE
  TO authenticated
  USING (
    -- Super admins can delete any driver
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can delete drivers in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );
