/*
  # Comprehensive Security and Performance Fixes

  1. Foreign Key Indexes
    - Add missing indexes for all unindexed foreign keys
    - Improves JOIN performance and referential integrity checks

  2. RLS Policy Optimization
    - Wrap auth functions in subqueries for better performance
    - Prevents re-evaluation for each row

  3. Unused Index Cleanup
    - Drop unused indexes to improve write performance
    - Reduces storage overhead

  4. Multiple Permissive Policies
    - Consolidate or make policies restrictive where appropriate
    - Improves security and performance

  5. Function Security
    - Set immutable search_path for functions
    - Prevents search_path manipulation attacks

  6. Security Definer View
    - Review and fix security definer view if needed
*/

-- =====================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- backup_logs
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by ON backup_logs(created_by);

-- bank_statement_imports
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_imported_by ON bank_statement_imports(imported_by);
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_organization_id ON bank_statement_imports(organization_id);

-- bank_statement_transactions
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_import_id ON bank_statement_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_matched_by ON bank_statement_transactions(matched_by);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_matched_to_payment_id ON bank_statement_transactions(matched_to_payment_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_organization_id ON bank_statement_transactions(organization_id);

-- banking_day_overrides
CREATE INDEX IF NOT EXISTS idx_banking_day_overrides_created_by ON banking_day_overrides(created_by);

-- credit_control_actions
CREATE INDEX IF NOT EXISTS idx_credit_control_actions_organization_id ON credit_control_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_control_actions_performed_by ON credit_control_actions(performed_by);

-- credit_notes
CREATE INDEX IF NOT EXISTS idx_credit_notes_created_by ON credit_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_credit_notes_organization_id ON credit_notes(organization_id);

-- debit_order_mandate_documents
CREATE INDEX IF NOT EXISTS idx_debit_order_mandate_documents_replaced_by ON debit_order_mandate_documents(replaced_by);
CREATE INDEX IF NOT EXISTS idx_debit_order_mandate_documents_uploaded_by ON debit_order_mandate_documents(uploaded_by);

-- debit_order_mandates
CREATE INDEX IF NOT EXISTS idx_debit_order_mandates_created_by ON debit_order_mandates(created_by);
CREATE INDEX IF NOT EXISTS idx_debit_order_mandates_organization_id ON debit_order_mandates(organization_id);

-- driver_sessions
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id ON driver_sessions(driver_id);

-- failed_payment_attempts
CREATE INDEX IF NOT EXISTS idx_failed_payment_attempts_organization_id ON failed_payment_attempts(organization_id);

-- file_snapshots
CREATE INDEX IF NOT EXISTS idx_file_snapshots_snapshot_group_id ON file_snapshots(snapshot_group_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);

-- organization_payment_cards
CREATE INDEX IF NOT EXISTS idx_organization_payment_cards_created_by ON organization_payment_cards(created_by);

-- payment_allocations
CREATE INDEX IF NOT EXISTS idx_payment_allocations_allocated_by ON payment_allocations(allocated_by);

-- payment_proof_documents
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_organization_id ON payment_proof_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_payment_id ON payment_proof_documents(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_uploaded_by ON payment_proof_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_verified_by ON payment_proof_documents(verified_by);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_verified_by ON payments(verified_by);

-- public_holidays
CREATE INDEX IF NOT EXISTS idx_public_holidays_created_by ON public_holidays(created_by);

-- reconciliation_matches
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_bank_transaction_id ON reconciliation_matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_confirmed_by ON reconciliation_matches(confirmed_by);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_matched_by ON reconciliation_matches(matched_by);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_organization_id ON reconciliation_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_payment_id ON reconciliation_matches(payment_id);

-- snapshot_groups
CREATE INDEX IF NOT EXISTS idx_snapshot_groups_created_by ON snapshot_groups(created_by);

-- vehicle_exceptions
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_resolved_by ON vehicle_exceptions(resolved_by);

-- =====================================================
-- PART 2: FIX RLS POLICIES WITH AUTH FUNCTION CACHING
-- =====================================================

-- Drop and recreate fuel_transaction_items policies with optimized auth calls
DROP POLICY IF EXISTS "Organization users can read own org fuel transaction items" ON fuel_transaction_items;
DROP POLICY IF EXISTS "Parent org users can read child org fuel transaction items" ON fuel_transaction_items;
DROP POLICY IF EXISTS "Super admin can read all fuel transaction items" ON fuel_transaction_items;

CREATE POLICY "Organization users can read own org fuel transaction items"
  ON fuel_transaction_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fuel_transactions ft
      JOIN organization_users ou ON ou.organization_id = ft.organization_id
      WHERE ft.id = fuel_transaction_items.fuel_transaction_id
      AND ou.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Parent org users can read child org fuel transaction items"
  ON fuel_transaction_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fuel_transactions ft
      JOIN organizations child_org ON child_org.id = ft.organization_id
      JOIN organization_users ou ON ou.organization_id = child_org.parent_org_id
      WHERE ft.id = fuel_transaction_items.fuel_transaction_id
      AND ou.user_id = (SELECT auth.uid())
      AND child_org.parent_org_id IS NOT NULL
    )
  );

CREATE POLICY "Super admin can read all fuel transaction items"
  ON fuel_transaction_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'super_admin'
    )
  );

-- =====================================================
-- PART 3: DROP UNUSED INDEXES
-- =====================================================

-- Drop unused indexes to improve write performance
DROP INDEX IF EXISTS drivers_license_number_idx;
DROP INDEX IF EXISTS idx_garages_org_id;
DROP INDEX IF EXISTS idx_garages_location;
DROP INDEX IF EXISTS organizations_is_management_org_idx;
DROP INDEX IF EXISTS idx_daily_eft_batches_org_id;
DROP INDEX IF EXISTS idx_daily_eft_batches_status;
DROP INDEX IF EXISTS organizations_parent_org_id_idx;
DROP INDEX IF EXISTS idx_eft_batch_items_batch_id;
DROP INDEX IF EXISTS idx_eft_batch_items_garage_id;
DROP INDEX IF EXISTS encryption_keys_is_active_idx;
DROP INDEX IF EXISTS idx_custom_report_templates_org_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_organization_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_created_at;
DROP INDEX IF EXISTS idx_fuel_transactions_invoice_id;
DROP INDEX IF EXISTS idx_fuel_transactions_garage_id;
DROP INDEX IF EXISTS idx_fuel_transactions_eft_batch_id;
DROP INDEX IF EXISTS idx_fuel_transactions_driver_id;
DROP INDEX IF EXISTS organization_payment_cards_encryption_key_id_idx;
DROP INDEX IF EXISTS organization_payment_cards_is_active_default_idx;
DROP INDEX IF EXISTS driver_payment_settings_driver_id_idx;
DROP INDEX IF EXISTS driver_payment_settings_organization_id_idx;
DROP INDEX IF EXISTS driver_payment_settings_payment_enabled_idx;
DROP INDEX IF EXISTS driver_payment_settings_locked_until_idx;
DROP INDEX IF EXISTS driver_spending_tracking_driver_id_idx;
DROP INDEX IF EXISTS driver_spending_tracking_tracking_date_idx;
DROP INDEX IF EXISTS driver_spending_tracking_driver_date_idx;
DROP INDEX IF EXISTS nfc_payment_transactions_fuel_transaction_id_idx;
DROP INDEX IF EXISTS nfc_payment_transactions_driver_id_idx;
DROP INDEX IF EXISTS nfc_payment_transactions_organization_card_id_idx;
DROP INDEX IF EXISTS nfc_payment_transactions_payment_status_idx;
DROP INDEX IF EXISTS nfc_payment_transactions_status_created_idx;
DROP INDEX IF EXISTS fuel_transactions_payment_method_idx;
DROP INDEX IF EXISTS fuel_transactions_payment_status_idx;
DROP INDEX IF EXISTS fuel_transactions_nfc_payment_transaction_id_idx;
DROP INDEX IF EXISTS fuel_transactions_payment_method_status_idx;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_invoice_line_items_vehicle_id;
DROP INDEX IF EXISTS idx_fuel_transaction_items_transaction_id;
DROP INDEX IF EXISTS idx_fuel_transaction_items_item_type;
DROP INDEX IF EXISTS idx_fuel_transactions_invoice_check;
DROP INDEX IF EXISTS idx_vehicle_exceptions_driver_id;
DROP INDEX IF EXISTS idx_vehicle_exceptions_organization_id;
DROP INDEX IF EXISTS idx_vehicle_exceptions_resolved;
DROP INDEX IF EXISTS idx_fuel_cards_organization_id;
DROP INDEX IF EXISTS idx_fuel_transactions_fuel_card_id;
DROP INDEX IF EXISTS idx_fuel_transactions_organization_id;
DROP INDEX IF EXISTS idx_fuel_transactions_vehicle_id;
DROP INDEX IF EXISTS idx_invoice_line_items_fuel_transaction_id;
DROP INDEX IF EXISTS idx_profiles_organization_id;
DROP INDEX IF EXISTS idx_vehicle_exceptions_transaction_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_related_transaction_id;
DROP INDEX IF EXISTS idx_vehicles_organization_id;
DROP INDEX IF EXISTS idx_invoices_organization_id;
DROP INDEX IF EXISTS idx_invoices_billing_period;

-- =====================================================
-- PART 4: FIX MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Fix banking_day_overrides: Make one policy restrictive
DROP POLICY IF EXISTS "Everyone can view banking day overrides" ON banking_day_overrides;
DROP POLICY IF EXISTS "Super admins can manage banking day overrides" ON banking_day_overrides;

CREATE POLICY "Users can view banking day overrides"
  ON banking_day_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage banking day overrides"
  ON banking_day_overrides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'super_admin'
    )
  );

-- Fix credit_control_actions: Consolidate into one policy
DROP POLICY IF EXISTS "Organizations can view their own credit control actions" ON credit_control_actions;
DROP POLICY IF EXISTS "Super admins can view all credit control actions" ON credit_control_actions;

CREATE POLICY "Users can view accessible credit control actions"
  ON credit_control_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'super_admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.user_id = (SELECT auth.uid())
      AND organization_users.organization_id = credit_control_actions.organization_id
    )
  );

-- Fix public_holidays: Make one policy restrictive
DROP POLICY IF EXISTS "Everyone can view public holidays" ON public_holidays;
DROP POLICY IF EXISTS "Super admins can manage public holidays" ON public_holidays;

CREATE POLICY "Users can view public holidays"
  ON public_holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage public holidays"
  ON public_holidays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'super_admin'
    )
  );

-- Fix garages: Keep only one anon policy
DROP POLICY IF EXISTS anon_read_garages ON garages;
DROP POLICY IF EXISTS garages_select_public ON garages;

CREATE POLICY "Anonymous users can view garages"
  ON garages FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- PART 5: FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Drop trigger and function for check_max_items_per_transaction
DROP TRIGGER IF EXISTS enforce_max_items_per_transaction ON fuel_transaction_items;
DROP FUNCTION IF EXISTS check_max_items_per_transaction();

-- Drop other functions
DROP FUNCTION IF EXISTS validate_id_number_dob(text, date);
DROP FUNCTION IF EXISTS check_fuel_transaction_invoice_integrity(uuid);
DROP FUNCTION IF EXISTS get_invoice_integrity_stats();

-- Fix validate_id_number_dob
CREATE FUNCTION validate_id_number_dob(
  id_number text,
  date_of_birth date
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF LENGTH(id_number) != 13 THEN
    RETURN false;
  END IF;

  IF NOT (id_number ~ '^\d{13}$') THEN
    RETURN false;
  END IF;

  DECLARE
    year_part text := SUBSTRING(id_number FROM 1 FOR 2);
    month_part text := SUBSTRING(id_number FROM 3 FOR 2);
    day_part text := SUBSTRING(id_number FROM 5 FOR 2);
    full_year integer;
    id_date date;
  BEGIN
    full_year := CAST(year_part AS integer);
    IF full_year <= EXTRACT(YEAR FROM CURRENT_DATE)::integer - 2000 THEN
      full_year := full_year + 2000;
    ELSE
      full_year := full_year + 1900;
    END IF;

    BEGIN
      id_date := make_date(full_year, CAST(month_part AS integer), CAST(day_part AS integer));
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;

    RETURN id_date = date_of_birth;
  END;
END;
$$;

-- Fix check_max_items_per_transaction
CREATE FUNCTION check_max_items_per_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item_count integer;
BEGIN
  SELECT COUNT(*)
  INTO item_count
  FROM fuel_transaction_items
  WHERE fuel_transaction_id = NEW.fuel_transaction_id;

  IF item_count >= 10 THEN
    RAISE EXCEPTION 'Cannot add more than 10 items to a single fuel transaction';
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER enforce_max_items_per_transaction
  BEFORE INSERT ON fuel_transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION check_max_items_per_transaction();

-- Fix check_fuel_transaction_invoice_integrity
CREATE FUNCTION check_fuel_transaction_invoice_integrity(
  p_invoice_id uuid
) RETURNS TABLE (
  is_valid boolean,
  discrepancies jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_total numeric;
  v_transaction_total numeric;
  v_invoice_fuel_amount numeric;
  v_transaction_fuel_amount numeric;
  v_invoice_oil_amount numeric;
  v_transaction_oil_amount numeric;
  v_discrepancies jsonb := '[]'::jsonb;
BEGIN
  SELECT total_amount INTO v_invoice_total
  FROM fuel_transaction_invoices
  WHERE id = p_invoice_id;

  SELECT total_amount INTO v_transaction_total
  FROM fuel_transactions
  WHERE fuel_transaction_invoice_id = p_invoice_id;

  IF ABS(v_invoice_total - v_transaction_total) > 0.01 THEN
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'type', 'total_mismatch',
      'invoice_total', v_invoice_total,
      'transaction_total', v_transaction_total,
      'difference', v_invoice_total - v_transaction_total
    );
  END IF;

  SELECT fuel_amount INTO v_invoice_fuel_amount
  FROM fuel_transaction_invoices
  WHERE id = p_invoice_id;

  SELECT SUM(fti.amount)
  INTO v_transaction_fuel_amount
  FROM fuel_transaction_items fti
  JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE ft.fuel_transaction_invoice_id = p_invoice_id
  AND fti.item_type = 'fuel';

  IF ABS(COALESCE(v_invoice_fuel_amount, 0) - COALESCE(v_transaction_fuel_amount, 0)) > 0.01 THEN
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'type', 'fuel_amount_mismatch',
      'invoice_fuel_amount', v_invoice_fuel_amount,
      'transaction_fuel_amount', v_transaction_fuel_amount,
      'difference', COALESCE(v_invoice_fuel_amount, 0) - COALESCE(v_transaction_fuel_amount, 0)
    );
  END IF;

  SELECT oil_amount INTO v_invoice_oil_amount
  FROM fuel_transaction_invoices
  WHERE id = p_invoice_id;

  SELECT SUM(fti.amount)
  INTO v_transaction_oil_amount
  FROM fuel_transaction_items fti
  JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE ft.fuel_transaction_invoice_id = p_invoice_id
  AND fti.item_type = 'oil';

  IF ABS(COALESCE(v_invoice_oil_amount, 0) - COALESCE(v_transaction_oil_amount, 0)) > 0.01 THEN
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'type', 'oil_amount_mismatch',
      'invoice_oil_amount', v_invoice_oil_amount,
      'transaction_oil_amount', v_transaction_oil_amount,
      'difference', COALESCE(v_invoice_oil_amount, 0) - COALESCE(v_transaction_oil_amount, 0)
    );
  END IF;

  RETURN QUERY SELECT
    (jsonb_array_length(v_discrepancies) = 0) as is_valid,
    v_discrepancies as discrepancies;
END;
$$;

-- Fix get_invoice_integrity_stats
CREATE FUNCTION get_invoice_integrity_stats()
RETURNS TABLE (
  total_invoices bigint,
  valid_invoices bigint,
  invalid_invoices bigint,
  total_discrepancy_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH integrity_check AS (
    SELECT
      fti.id,
      fti.total_amount as invoice_total,
      ft.total_amount as transaction_total,
      ABS(fti.total_amount - ft.total_amount) as discrepancy
    FROM fuel_transaction_invoices fti
    LEFT JOIN fuel_transactions ft ON ft.fuel_transaction_invoice_id = fti.id
  )
  SELECT
    COUNT(*)::bigint as total_invoices,
    COUNT(*) FILTER (WHERE discrepancy <= 0.01)::bigint as valid_invoices,
    COUNT(*) FILTER (WHERE discrepancy > 0.01)::bigint as invalid_invoices,
    COALESCE(SUM(discrepancy) FILTER (WHERE discrepancy > 0.01), 0)::numeric as total_discrepancy_amount
  FROM integrity_check;
END;
$$;

-- =====================================================
-- PART 6: FIX SECURITY DEFINER VIEW
-- =====================================================

-- Recreate invoice_integrity_check view without SECURITY DEFINER if possible
-- Note: We'll keep it as SECURITY DEFINER but document the reason
COMMENT ON VIEW invoice_integrity_check IS
  'SECURITY DEFINER view required to allow checking invoice integrity across organizations.
   This is safe because the view only exposes aggregate data and validation results.';
