-- F12: anonymous callers could read every organization's garage account numbers and limits.

DROP POLICY IF EXISTS "Anonymous users can view organization garage accounts" ON public.organization_garage_accounts;

CREATE POLICY "org_garage_accounts_select_driver_own_org_anon"
  ON public.organization_garage_accounts
  FOR SELECT
  TO anon
  USING (organization_id = public.current_driver_org_id());
