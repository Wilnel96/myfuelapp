/*
  # Fix Vehicles RLS Policies - Add Super Admin Bypass
  
  1. Problem
    - Super admins cannot create/update/delete vehicles for other organizations
    - Current policies only check if organization_id matches user's profile organization_id
    - Super admins need full access to all vehicles across all organizations
  
  2. Changes
    - Update all vehicle policies to allow super_admin bypass
    - Policies now check: user is super_admin OR organization matches user's org
  
  3. Security
    - Regular users: Can only access vehicles in their own organization
    - Super admins: Can access all vehicles in all organizations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;

-- SELECT policy: Super admin can view all, regular users can view their org's vehicles
CREATE POLICY "vehicles_select_policy"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    -- Super admin can view all vehicles
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Regular users can view their organization's vehicles
    organization_id IN (
      SELECT profiles.organization_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- INSERT policy: Super admin can insert for any org, regular users for their org only
CREATE POLICY "vehicles_insert_policy"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin can insert vehicles for any organization
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Regular users can only insert for their organization
    organization_id IN (
      SELECT profiles.organization_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- UPDATE policy: Super admin can update all, regular users can update their org's vehicles
CREATE POLICY "vehicles_update_policy"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    -- Super admin can update any vehicle
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Regular users can only update their organization's vehicles
    organization_id IN (
      SELECT profiles.organization_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    -- Super admin can update to any organization
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Regular users can only keep vehicles in their organization
    organization_id IN (
      SELECT profiles.organization_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- DELETE policy: Super admin can delete all, regular users can delete their org's vehicles
CREATE POLICY "vehicles_delete_policy"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    -- Super admin can delete any vehicle
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Regular users can only delete their organization's vehicles
    organization_id IN (
      SELECT profiles.organization_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );
