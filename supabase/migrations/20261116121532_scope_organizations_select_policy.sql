/*
  # Scope organization reads

  1. Problem
     - organizations_select_policy was `USING (true)` for every signed-in user, so any
       account could read every client's banking and contact details.

  2. Changes
     - Replace it with a predicate limited to the caller's own organization, its
       children, organizations they are a member of, organizations managed by their
       garage, and platform operators (super_admin / management).
*/

DROP POLICY IF EXISTS organizations_select_policy ON organizations;

CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
    OR parent_org_id IN (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid())
    OR id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid() AND ou.is_active = true
    )
    OR managing_garage_id IN (
      SELECT g.id FROM garages g
      JOIN profiles p ON p.organization_id = g.organization_id
      WHERE p.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['super_admin'::text, 'management'::text])
    )
  );
