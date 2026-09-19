-- F1: anonymous (driver-app) callers could read every organization, including banking details.
-- Scope rows to the driver's own organization and expose only the columns the driver app reads.

DROP POLICY IF EXISTS "organizations_select_policy_anon" ON public.organizations;

CREATE POLICY "organizations_select_driver_own_org_anon"
  ON public.organizations
  FOR SELECT
  TO anon
  USING (id = public.current_driver_org_id());

REVOKE SELECT ON public.organizations FROM anon;

GRANT SELECT (
  id,
  name,
  payment_option,
  daily_spending_limit,
  monthly_spending_limit
) ON public.organizations TO anon;
