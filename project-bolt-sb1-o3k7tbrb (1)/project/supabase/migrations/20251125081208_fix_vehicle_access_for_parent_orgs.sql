/*
  # Fix Vehicle Access for Parent Organizations

  ## Summary
  Allow management organizations (parent orgs) to view and manage vehicles from their client organizations (child orgs).

  ## Changes Made
  - Updated vehicle SELECT policy to include vehicles from child organizations
  - Updated vehicle INSERT/UPDATE/DELETE policies to allow management of child org vehicles
  - Maintains security by checking the parent_org_id relationship

  ## Security Notes
  - Users can only see vehicles from their own organization OR child organizations
  - Maintains proper access control through the parent_org_id relationship
*/

-- Drop existing vehicle policies
DROP POLICY IF EXISTS "Users can view vehicles in their organization" ON vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles in their organization" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles in their organization" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles in their organization" ON vehicles;

-- Allow users to view vehicles from their org AND child organizations
CREATE POLICY "Users can view vehicles in their organization and child orgs"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      -- User's own organization
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      -- Child organizations where user's org is the parent
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow users to insert vehicles in their org AND child organizations
CREATE POLICY "Users can insert vehicles in their organization and child orgs"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      -- User's own organization
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      -- Child organizations where user's org is the parent
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow users to update vehicles in their org AND child organizations
CREATE POLICY "Users can update vehicles in their organization and child orgs"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      -- User's own organization
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      -- Child organizations where user's org is the parent
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      -- User's own organization
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      -- Child organizations where user's org is the parent
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow users to delete vehicles in their org AND child organizations
CREATE POLICY "Users can delete vehicles in their organization and child orgs"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      -- User's own organization
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      -- Child organizations where user's org is the parent
      SELECT o.id FROM organizations o
      WHERE o.parent_org_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
