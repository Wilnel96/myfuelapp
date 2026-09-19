-- F3: PIN hashes and salts were readable by anonymous callers and by every signed-in user.

DROP POLICY IF EXISTS "Anonymous users can view driver spending limits" ON public.driver_payment_settings;
DROP POLICY IF EXISTS "Users can view driver payment settings" ON public.driver_payment_settings;

CREATE POLICY "driver_payment_settings_select_own_driver_anon"
  ON public.driver_payment_settings
  FOR SELECT
  TO anon
  USING (driver_id = public.current_driver_id());

CREATE POLICY "driver_payment_settings_select_own_org"
  ON public.driver_payment_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_management_org_user()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.organization_id = driver_payment_settings.organization_id OR p.role = 'super_admin')
    )
  );

-- The driver app never writes this table directly; PIN changes go through a server function.
REVOKE INSERT, UPDATE, DELETE ON public.driver_payment_settings FROM anon;

REVOKE SELECT ON public.driver_payment_settings FROM anon, authenticated;

GRANT SELECT (
  id,
  driver_id,
  organization_id,
  daily_spending_limit,
  monthly_spending_limit,
  payment_enabled,
  is_pin_active,
  require_pin_change,
  failed_pin_attempts,
  locked_until,
  last_payment_at,
  pin_last_changed,
  created_at,
  updated_at
) ON public.driver_payment_settings TO anon, authenticated;
