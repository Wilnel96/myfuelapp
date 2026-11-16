/*
  # Allow platform staff to read organizations

  Members of the management organization run the platform and must retain
  visibility of every client. A SECURITY DEFINER helper answers that question
  without the organizations policy querying its own table (which would recurse).
*/

CREATE OR REPLACE FUNCTION public.is_management_org_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid() AND o.is_management_org = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_management_org_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_management_org_member() TO authenticated, service_role;

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
    OR public.is_management_org_member()
  );
