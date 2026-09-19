-- F10: anonymous callers could read every organization's fuel purchases, line items and invoices.

DROP POLICY IF EXISTS "fuel_transactions_select_policy_anon" ON public.fuel_transactions;
DROP POLICY IF EXISTS "Anonymous users can read fuel transaction items" ON public.fuel_transaction_items;
DROP POLICY IF EXISTS "Garages can view their fuel transaction invoices" ON public.fuel_transaction_invoices;

CREATE POLICY "fuel_transactions_select_driver_own_org_anon"
  ON public.fuel_transactions
  FOR SELECT
  TO anon
  USING (organization_id = public.current_driver_org_id());

CREATE POLICY "fuel_transaction_items_select_driver_own_org_anon"
  ON public.fuel_transaction_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.fuel_transactions ft
      WHERE ft.id = fuel_transaction_items.fuel_transaction_id
        AND ft.organization_id = public.current_driver_org_id()
    )
  );

CREATE POLICY "fuel_transaction_invoices_select_driver_own_org_anon"
  ON public.fuel_transaction_invoices
  FOR SELECT
  TO anon
  USING (organization_id = public.current_driver_org_id());
