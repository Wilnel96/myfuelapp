/*
  # Avoid recursion in the profiles select policy

  The previous predicate queried `profiles` from inside the `profiles` policy, which
  Postgres rejects as infinite recursion. Resolve the caller's organization through a
  SECURITY DEFINER helper instead.
*/

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated, service_role;

DROP POLICY IF EXISTS profiles_select_policy ON profiles;

CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      organization_id IS NOT NULL
      AND organization_id = public.current_user_org_id()
    )
    OR public.is_management_org_member()
  );
