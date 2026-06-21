-- =============================================================================
-- Comprehensive Security Fix Migration
-- Addresses: SECURITY DEFINER view, RLS gaps, always-true policies,
--            and SECURITY DEFINER function access by anon/authenticated roles
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fix SECURITY DEFINER view: invoice_integrity_check
--    Views are SECURITY INVOKER by default when recreated without that property.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.invoice_integrity_check;

CREATE VIEW public.invoice_integrity_check AS
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.organization_id,
  i.total_amount AS invoice_total,
  COALESCE(SUM(ili.line_total), 0) AS line_items_total,
  (i.total_amount - COALESCE(SUM(ili.line_total), 0)) AS difference,
  CASE
    WHEN ABS(i.total_amount - COALESCE(SUM(ili.line_total), 0)) > 0.01 THEN 'MISMATCH'
    ELSE 'OK'
  END AS status
FROM invoices i
LEFT JOIN invoice_line_items ili ON ili.invoice_id = i.id
GROUP BY i.id, i.invoice_number, i.organization_id, i.total_amount;

-- Grant access to the view for authenticated users only (not anon)
REVOKE ALL ON public.invoice_integrity_check FROM anon;
GRANT SELECT ON public.invoice_integrity_check TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Enable RLS on credit_note_sequence and add appropriate policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.credit_note_sequence ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (management/admin) should read the sequence
CREATE POLICY "authenticated_can_read_credit_note_sequence"
  ON public.credit_note_sequence FOR SELECT
  TO authenticated USING (true);

-- Only service role (via functions) should insert/update — no direct user access

-- -----------------------------------------------------------------------------
-- 3. Fix always-true anon RLS policies on garage_client_payments
--    The authenticated role already has proper policies covering these operations.
--    Drop the unrestricted anon INSERT and UPDATE policies.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anonymous garage can insert payments" ON public.garage_client_payments;
DROP POLICY IF EXISTS "Anonymous garage can update payments" ON public.garage_client_payments;

-- Recreate with proper restriction: only allow anon inserts when garage_id
-- matches a garage authenticated by the x-garage-password header
CREATE POLICY "Anonymous garage can insert payments"
  ON public.garage_client_payments FOR INSERT
  TO anon
  WITH CHECK (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(
        ((current_setting('request.headers', true))::json ->> 'x-garage-password'),
        password
      )
    )
  );

CREATE POLICY "Anonymous garage can update payments"
  ON public.garage_client_payments FOR UPDATE
  TO anon
  USING (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(
        ((current_setting('request.headers', true))::json ->> 'x-garage-password'),
        password
      )
    )
  )
  WITH CHECK (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(
        ((current_setting('request.headers', true))::json ->> 'x-garage-password'),
        password
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Fix always-true anon RLS policy on garage_statements
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anonymous garage can insert statements" ON public.garage_statements;

CREATE POLICY "Anonymous garage can insert statements"
  ON public.garage_statements FOR INSERT
  TO anon
  WITH CHECK (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(
        ((current_setting('request.headers', true))::json ->> 'x-garage-password'),
        password
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Revoke EXECUTE from anon on all SECURITY DEFINER functions
--    These functions run with elevated privileges and must not be callable
--    by unauthenticated (anon) users via the REST API.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.acquire_transaction_lock(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acquire_transaction_lock(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.allocate_payment(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_late_payment_interest() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_generate_fuel_transaction_invoice() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_grant_main_user_permissions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_grant_permissions_for_main_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_grant_permissions_to_secondary_main_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_match_bank_transactions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.belongs_to_organization(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_statement_totals(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_driver_payment_settings(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_organization_users(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_organization_users(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_driver_spending_limit(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_fuel_transaction_invoice_integrity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_fuel_transaction_invoice_integrity(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_garage_account_limit(uuid, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_max_items_per_transaction() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_organization_spending_limit(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_vehicle_drawn_by_driver(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_vehicle_not_already_drawn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_client_signup(uuid, text, text, text, text, text, text, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_client_signup(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_nfc_payment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_driver_payment_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_garage_user(uuid, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_garage_with_organization(jsonb, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_old_mandates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fail_nfc_payment_fallback_to_eft(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_debit_order_batch(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_debit_order_run_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_fuel_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_garage_statement_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_invoices(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_payment_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_payment_number(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_current_spending(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_invoice_integrity_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_credit_note_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_statement_invoices(uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_statement_payments(uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_valid_debit_order_mandate(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_driver_spending(uuid, numeric, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_client_organization(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_management_org_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_management_org_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_management_organization(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_garage_user_to_organization(uuid, uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_debit_orders_submitted(uuid[], timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_credit_control() FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_debit_order_results(uuid, boolean, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.public_garage_signup(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.retry_failed_payments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.suggest_payment_matches(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_is_garage_managed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_title_with_flags() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_user_title_with_flags() FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_secondary_main_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_main_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_credit_notes_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_invoice_amounts_after_payment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_invoice_totals(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_organization_garage_accounts_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_payment_allocation_amounts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.uppercase_registration_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_mandate(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_see_organization(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_id_number_dob() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_id_number_dob(text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_management_org_no_driver_role() FROM anon;

-- -----------------------------------------------------------------------------
-- 6. Revoke EXECUTE from authenticated on internal/trigger-only functions
--    These should only be invoked by triggers or the service role, not directly
--    by authenticated users via the REST API.
-- -----------------------------------------------------------------------------
-- Trigger functions (must not be callable by users directly)
REVOKE EXECUTE ON FUNCTION public.auto_generate_fuel_transaction_invoice() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_grant_main_user_permissions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_grant_permissions_for_main_users() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_grant_permissions_to_secondary_main_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_fuel_transaction_invoice_integrity() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_max_items_per_transaction() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_vehicle_not_already_drawn() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_driver_payment_settings() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_is_garage_managed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_title_with_flags() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_title_with_flags() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_credit_notes_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_invoice_amounts_after_payment() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_organization_garage_accounts_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_allocation_amounts() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.uppercase_registration_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_id_number_dob() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_management_org_no_driver_role() FROM authenticated;

-- Admin/internal functions that should only run via service role
REVOKE EXECUTE ON FUNCTION public.apply_late_payment_interest() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_mandates() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_debit_order_run_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_fuel_invoice_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_invoices(date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_credit_note_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_driver_spending(uuid, numeric, date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_credit_control() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_failed_payments() FROM authenticated;
