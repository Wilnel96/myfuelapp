/*
  # Fix Driver Access for Parent Organizations

  ## Summary
  Allow management organizations (parent orgs) to view and manage drivers from their client organizations (child orgs).

  ## Changes Made
  - Updated driver SELECT policy to include drivers from child organizations
  - Updated driver INSERT/UPDATE/DELETE policies to allow management of child org drivers
  - Maintains security by checking the parent_org_id relationship

  ## Security Notes
  - Users can only see drivers from their own organization OR child organizations
  - Maintains proper access control through the parent_org_id relationship
*/

-- Drop existing driver policies that only allow access to own org
DROP POLICY IF EXISTS "Users can view drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Users can insert drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Users can update drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Users can delete drivers in their organization" ON drivers;

-- Allow users to view drivers from their org AND child organizations
CREATE POLICY "Users can view drivers in their organization and child orgs"
  ON drivers FOR SELECT
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

-- Allow users to insert drivers in their org AND child organizations
CREATE POLICY "Users can insert drivers in their organization and child orgs"
  ON drivers FOR INSERT
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

-- Allow users to update drivers in their org AND child organizations
CREATE POLICY "Users can update drivers in their organization and child orgs"
  ON drivers FOR UPDATE
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

-- Allow users to delete drivers in their org AND child organizations
CREATE POLICY "Users can delete drivers in their organization and child orgs"
  ON drivers FOR DELETE
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
