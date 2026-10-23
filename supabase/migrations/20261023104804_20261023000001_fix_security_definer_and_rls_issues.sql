-- ===========================================================================
-- Fix security findings: SECURITY DEFINER exposure, RLS gaps, view bypass
-- ===========================================================================

-- 1. Enable RLS on _schema_backup_log (RLS Disabled in Public)
ALTER TABLE public._schema_backup_log ENABLE ROW LEVEL SECURITY;
-- Only service_role / super_admin should touch this internal log table.
REVOKE ALL ON public._schema_backup_log FROM anon, authenticated;

-- 2. Add a deny-by-default policy to driver_sessions (RLS Enabled No Policy)
--    driver_sessions is accessed via the validate-driver-session edge function
--    using the service role, so anon/authenticated should get nothing.
REVOKE ALL ON public.driver_sessions FROM anon, authenticated;
-- A restrictive policy so the table is never reachable via the Data API.
CREATE POLICY "driver_sessions_deny_all" ON public.driver_sessions
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 3. Convert invoice_integrity_check view to SECURITY INVOKER (View bypasses RLS)
--    On Postgres 15+ this makes the view run with the caller's privileges
--    so RLS on the underlying tables is respected.
CREATE OR REPLACE VIEW public.invoice_integrity_check
  WITH (security_invoker = true) AS
SELECT i.id AS invoice_id,
       i.invoice_number,
       i.organization_id,
       i.total_amount AS invoice_total,
       COALESCE(sum(ili.line_total), 0::numeric) AS line_items_total,
       i.total_amount - COALESCE(sum(ili.line_total), 0::numeric) AS difference,
       CASE
         WHEN abs(i.total_amount - COALESCE(sum(ili.line_total), 0::numeric)) > 0.01
         THEN 'MISMATCH'::text
         ELSE 'OK'::text
       END AS status
FROM invoices i
LEFT JOIN invoice_line_items ili ON ili.invoice_id = i.id
GROUP BY i.id, i.invoice_number, i.organization_id, i.total_amount;

-- ===========================================================================
-- 4. Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions, then
--    re-grant only to the roles that genuinely need them.
--
--    Postgres grants EXECUTE TO PUBLIC by default; anon and authenticated
--    inherit from PUBLIC. We revoke from PUBLIC and grant explicitly.
-- ===========================================================================

-- Revoke EXECUTE from PUBLIC on ALL SECURITY DEFINER functions in public schema.
-- This is the blanket reset; targeted grants follow.
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOR fn IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC', fn);
  END LOOP;
END $$;

-- Also revoke from anon and authenticated explicitly (they may have direct grants).
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOR fn IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM authenticated', fn);
  END LOOP;
END $$;

-- ===========================================================================
-- Targeted re-grants
-- ===========================================================================

-- A) Functions used in RLS policies evaluated for the `anon` role
--    (driver mobile app uses anon key). These MUST keep anon EXECUTE.
GRANT EXECUTE ON FUNCTION public.current_driver_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_driver_org_id() TO anon, authenticated;

-- B) Functions used in RLS policies evaluated for `authenticated` only.
--    These need authenticated EXECUTE but NOT anon.
GRANT EXECUTE ON FUNCTION public.is_management_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_management_org_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_management_org_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.belongs_to_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_org_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_organization_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_organization_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_driver_employment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_driver_employment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_garage_fee_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_garage_statement_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_mandate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_see_organization(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_debit_order_mandate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_garage_account_limit(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_driver_spending_limit(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_organization_spending_limit(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_vehicle_drawn_by_driver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_fuel_transaction_invoice_integrity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_statement_totals(uuid) TO authenticated;

-- C) Functions called via RPC from authenticated client code.
GRANT EXECUTE ON FUNCTION public.soft_delete_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_vehicle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_vehicle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_registration_number_availability(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_driver_trailer_license_qualifies(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_current_spending(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_statement_invoices(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_statement_payments(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_payment_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_payment_number(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_garage_statement_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_debit_order_run_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_credit_note_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_statement_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_main_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_secondary_main_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_secondary_main_user_with_role(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_garage_user_to_organization(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_id_number_dob(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_payment_matches(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_integrity_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_transaction_lock(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_transaction_lock(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_garage_signup(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_signup(uuid, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_signup(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_garage_with_organization(jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_driver_payment_settings(uuid) TO authenticated;

-- D) Functions that are genuinely public (called before login via anon key).
GRANT EXECUTE ON FUNCTION public.public_garage_signup(jsonb) TO anon, authenticated;

-- E) Trigger functions — never callable via RPC. No EXECUTE grant needed.
--    sync_system_role_permissions(), update_vehicle_service_from_maintenance(),
--    uppercase_maintenance_fields(), uppercase_organization_fields()
--    These remain revoked from anon and authenticated (only callable by
--    the trigger owner / service_role internally).
