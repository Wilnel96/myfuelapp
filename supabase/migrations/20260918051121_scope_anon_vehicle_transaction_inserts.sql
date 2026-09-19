-- F8: anonymous callers could insert draw/return rows for any vehicle in any organization.

DROP POLICY IF EXISTS "vehicle_trans_insert_public" ON public.vehicle_transactions;

CREATE POLICY "vehicle_trans_insert_driver_own_anon"
  ON public.vehicle_transactions
  FOR INSERT
  TO anon
  WITH CHECK (
    vehicle_id IS NOT NULL
    AND transaction_type IS NOT NULL
    AND driver_id = public.current_driver_id()
    AND organization_id = public.current_driver_org_id()
  );
