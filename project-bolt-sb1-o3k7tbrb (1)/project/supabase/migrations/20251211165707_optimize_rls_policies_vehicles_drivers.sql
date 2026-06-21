/*
  # Optimize RLS Policies - Vehicles and Drivers
  
  This migration optimizes RLS policies for vehicles and drivers tables
  by wrapping auth.uid() calls to prevent re-evaluation per row.
  
  Tables optimized:
  - vehicles
  - drivers
*/

-- =====================================================
-- VEHICLES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles in their organization and child orgs" ON vehicles;
DROP POLICY IF EXISTS "Users can view all vehicles in their organization" ON vehicles;
DROP POLICY IF EXISTS "Super admin can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Super admins can view all vehicles" ON vehicles;

CREATE POLICY "Users can view vehicles in their organization and child orgs"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = vehicles.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = vehicles.organization_id
          ))
    )
  );

CREATE POLICY "Users can insert vehicles in their organization and child orgs"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = vehicles.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = vehicles.organization_id
          ))
    )
  );

CREATE POLICY "Users can update vehicles in their organization and child orgs"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = vehicles.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = vehicles.organization_id
          ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = vehicles.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = vehicles.organization_id
          ))
    )
  );

CREATE POLICY "Users can delete vehicles in their organization and child orgs"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = vehicles.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = vehicles.organization_id
          ))
    )
  );

CREATE POLICY "Super admins can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

-- =====================================================
-- DRIVERS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can insert drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can update drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can delete drivers in their organization and child orgs" ON drivers;
DROP POLICY IF EXISTS "Users can view all drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Super admin can view all drivers" ON drivers;
DROP POLICY IF EXISTS "Super admins can view all drivers" ON drivers;

CREATE POLICY "Users can view drivers in their organization and child orgs"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = drivers.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = drivers.organization_id
          ))
    )
  );

CREATE POLICY "Users can insert drivers in their organization and child orgs"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = drivers.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = drivers.organization_id
          ))
    )
  );

CREATE POLICY "Users can update drivers in their organization and child orgs"
  ON drivers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = drivers.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = drivers.organization_id
          ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = drivers.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = drivers.organization_id
          ))
    )
  );

CREATE POLICY "Users can delete drivers in their organization and child orgs"
  ON drivers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND (organization_id = drivers.organization_id 
          OR organization_id IN (
            SELECT id FROM organizations WHERE parent_org_id = drivers.organization_id
          ))
    )
  );

CREATE POLICY "Super admins can view all drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );
