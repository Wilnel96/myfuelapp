-- F11: anonymous callers could read garage statements for every organization.

DROP POLICY IF EXISTS "Anonymous garage can read own statements" ON public.garage_statements;

CREATE POLICY "garage_statements_select_driver_own_org_anon"
  ON public.garage_statements
  FOR SELECT
  TO anon
  USING (organization_id = public.current_driver_org_id());
