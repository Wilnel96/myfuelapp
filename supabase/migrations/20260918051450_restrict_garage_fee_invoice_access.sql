-- F15: all eight policies on the garage fee invoice tables were unconditionally true for
-- every signed-in user, so any account could read, alter or delete platform fee invoices.

DROP POLICY IF EXISTS "mgmt_select_garage_fee_invoices" ON public.garage_fee_invoices;
DROP POLICY IF EXISTS "mgmt_insert_garage_fee_invoices" ON public.garage_fee_invoices;
DROP POLICY IF EXISTS "mgmt_update_garage_fee_invoices" ON public.garage_fee_invoices;
DROP POLICY IF EXISTS "mgmt_delete_garage_fee_invoices" ON public.garage_fee_invoices;
DROP POLICY IF EXISTS "mgmt_select_garage_fee_line_items" ON public.garage_fee_invoice_line_items;
DROP POLICY IF EXISTS "mgmt_insert_garage_fee_line_items" ON public.garage_fee_invoice_line_items;
DROP POLICY IF EXISTS "mgmt_update_garage_fee_line_items" ON public.garage_fee_invoice_line_items;
DROP POLICY IF EXISTS "mgmt_delete_garage_fee_line_items" ON public.garage_fee_invoice_line_items;

-- Platform operators (management organisation users and super admins) manage these invoices.
CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('super_admin', 'management')
        OR EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = p.organization_id
            AND o.is_management_org = true
            AND o.organization_type = 'management'
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated, service_role;

-- A garage's own users may read the fee invoices addressed to that garage.
CREATE OR REPLACE FUNCTION public.can_view_garage_fee_invoice(p_garage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.is_platform_operator()
    OR EXISTS (
      SELECT 1
      FROM public.garages g
      JOIN public.profiles p ON p.organization_id = g.organization_id
      WHERE g.id = p_garage_id
        AND p.id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_garage_fee_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_garage_fee_invoice(uuid) TO authenticated, service_role;

CREATE POLICY "garage_fee_invoices_select"
  ON public.garage_fee_invoices FOR SELECT TO authenticated
  USING (public.can_view_garage_fee_invoice(garage_id));

CREATE POLICY "garage_fee_invoices_insert"
  ON public.garage_fee_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY "garage_fee_invoices_update"
  ON public.garage_fee_invoices FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY "garage_fee_invoices_delete"
  ON public.garage_fee_invoices FOR DELETE TO authenticated
  USING (public.is_platform_operator());

CREATE POLICY "garage_fee_line_items_select"
  ON public.garage_fee_invoice_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.garage_fee_invoices i
      WHERE i.id = garage_fee_invoice_line_items.invoice_id
        AND public.can_view_garage_fee_invoice(i.garage_id)
    )
  );

CREATE POLICY "garage_fee_line_items_insert"
  ON public.garage_fee_invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY "garage_fee_line_items_update"
  ON public.garage_fee_invoice_line_items FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY "garage_fee_line_items_delete"
  ON public.garage_fee_invoice_line_items FOR DELETE TO authenticated
  USING (public.is_platform_operator());
