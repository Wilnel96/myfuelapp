/*
  # Add Super Admin Bypass to Vehicles and Drivers RLS

  ## Summary
  Allow super_admins to view and manage ALL vehicles and drivers across all organizations, regardless of hierarchy.

  ## Changes Made
  - Updated vehicle policies to allow super_admins full access
  - Updated driver policies to allow super_admins full access
  - Regular users still follow org hierarchy rules

  ## Security Notes
  - Super admins (role = 'super_admin') can access all data
  - Regular users still restricted to their org and child orgs
*/

-- Drop and recreate vehicle policies with super admin bypass
DROP POLICY IF EXISTS "Users can view vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles in their organization and child orgs" ON vehicles;

CREATE POLICY "Users can view vehicles in their organization and child orgs"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    -- Super admins can see all vehicles
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can see vehicles from their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert vehicles in their organization and child orgs"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert anywhere
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can insert in their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update vehicles in their organization and child orgs"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update any vehicle
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can update vehicles in their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Super admins can update to any org
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can only update within their org hierarchy
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete vehicles in their organization and child orgs"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    -- Super admins can delete any vehicle
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can delete vehicles in their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Drop and recreate driver policies with super admin bypass
DROP POLICY IF EXISTS "Users can view drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can insert drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can update drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can delete drivers in their organization and child orgs" ON drivers;

CREATE POLICY "Users can view drivers in their organization and child orgs"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    -- Super admins can see all drivers
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can see drivers from their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert drivers in their organization and child orgs"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert anywhere
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can insert in their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update drivers in their organization and child orgs"
  ON drivers FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update any driver
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can update drivers in their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Super admins can update to any org
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can only update within their org hierarchy
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete drivers in their organization and child orgs"
  ON drivers FOR DELETE
  TO authenticated
  USING (
    -- Super admins can delete any driver
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can delete drivers in their org and child orgs
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
