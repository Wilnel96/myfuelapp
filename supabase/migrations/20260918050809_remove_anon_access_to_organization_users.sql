-- F5: anonymous callers could read the user table (names, emails, roles, stored passwords)
-- for any organization that had a garage account. No client feature needs anonymous access here.

DROP POLICY IF EXISTS "org_users_select_policy_anonymous" ON public.organization_users;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.organization_users FROM anon;
