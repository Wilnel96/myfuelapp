-- F7: anonymous callers could read every organization's vehicle movement history.

DROP POLICY IF EXISTS "vehicle_trans_select_public" ON public.vehicle_transactions;

CREATE POLICY "vehicle_trans_select_driver_own_org_anon"
  ON public.vehicle_transactions
  FOR SELECT
  TO anon
  USING (organization_id = public.current_driver_org_id());
