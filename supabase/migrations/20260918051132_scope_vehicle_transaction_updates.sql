-- F9: the UPDATE policy on vehicle_transactions allowed every anonymous and signed-in
-- caller to rewrite any organization's trip records. Replace it with scoped policies.

DROP POLICY IF EXISTS "vehicle_trans_update_public" ON public.vehicle_transactions;

CREATE POLICY "vehicle_trans_update_driver_own_anon"
  ON public.vehicle_transactions
  FOR UPDATE
  TO anon
  USING (
    driver_id = public.current_driver_id()
    AND organization_id = public.current_driver_org_id()
  )
  WITH CHECK (
    driver_id = public.current_driver_id()
    AND organization_id = public.current_driver_org_id()
  );

CREATE POLICY "vehicle_trans_update_by_org"
  ON public.vehicle_transactions
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR public.is_management_org_user()
  )
  WITH CHECK (
    organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR public.is_management_org_user()
  );
