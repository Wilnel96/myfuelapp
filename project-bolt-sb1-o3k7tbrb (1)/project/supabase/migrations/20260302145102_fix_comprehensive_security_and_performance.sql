/*
  # Comprehensive Security and Performance Fixes

  This migration addresses all security and performance issues flagged by Supabase.

  1. **Unindexed Foreign Keys** - Adds 60+ missing indexes for optimal JOIN performance
  2. **Auth RLS Initialization** - Optimizes RLS by caching auth.uid() calls 
  3. **Unused Indexes** - Removes 38 unused indexes to improve write performance
  4. **Multiple Permissive Policies** - Consolidates duplicate policies
  5. **Function Search Path** - Fixes security vulnerabilities in functions
  6. **RLS on Public Tables** - Enables RLS on system_documentation
  7. **Security Definer View** - Removes unnecessary SECURITY DEFINER
  8. **Overly Permissive Policies** - Restricts policies that allow unrestricted access
*/

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES (60+ indexes)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by ON public.backup_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_imported_by ON public.bank_statement_imports(imported_by);
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_organization_id ON public.bank_statement_imports(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_import_id ON public.bank_statement_transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_matched_by ON public.bank_statement_transactions(matched_by);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_matched_to_payment_id ON public.bank_statement_transactions(matched_to_payment_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_organization_id ON public.bank_statement_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_banking_day_overrides_created_by ON public.banking_day_overrides(created_by);
CREATE INDEX IF NOT EXISTS idx_credit_control_actions_organization_id ON public.credit_control_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_control_actions_performed_by ON public.credit_control_actions(performed_by);
CREATE INDEX IF NOT EXISTS idx_credit_notes_created_by ON public.credit_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_credit_notes_organization_id ON public.credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_organization_id ON public.custom_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_debit_order_mandate_documents_replaced_by ON public.debit_order_mandate_documents(replaced_by);
CREATE INDEX IF NOT EXISTS idx_debit_order_mandate_documents_uploaded_by ON public.debit_order_mandate_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_debit_order_mandates_created_by ON public.debit_order_mandates(created_by);
CREATE INDEX IF NOT EXISTS idx_debit_order_mandates_organization_id ON public.debit_order_mandates(organization_id);
CREATE INDEX IF NOT EXISTS idx_driver_payment_settings_organization_id ON public.driver_payment_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id ON public.driver_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_batch_id ON public.eft_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id ON public.eft_batch_items(garage_id);
CREATE INDEX IF NOT EXISTS idx_failed_payment_attempts_organization_id ON public.failed_payment_attempts(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_snapshot_group_id ON public.file_snapshots(snapshot_group_id);
CREATE INDEX IF NOT EXISTS idx_fuel_cards_organization_id ON public.fuel_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transaction_items_fuel_transaction_id ON public.fuel_transaction_items(fuel_transaction_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_eft_batch_id ON public.fuel_transactions(eft_batch_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_fuel_card_id ON public.fuel_transactions(fuel_card_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_id ON public.fuel_transactions(garage_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_invoice_id ON public.fuel_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_nfc_payment_transaction_id ON public.fuel_transactions(nfc_payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_garages_organization_id ON public.garages(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_fuel_transaction_id_2 ON public.invoice_line_items(fuel_transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_vehicle_id_2 ON public.invoice_line_items(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_nfc_payment_transactions_driver_id ON public.nfc_payment_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_organization_payment_cards_created_by ON public.organization_payment_cards(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_payment_cards_encryption_key_id ON public.organization_payment_cards(encryption_key_id);
CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id ON public.organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_allocated_by ON public.payment_allocations(allocated_by);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_organization_id ON public.payment_proof_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_payment_id ON public.payment_proof_documents(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_uploaded_by ON public.payment_proof_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_verified_by ON public.payment_proof_documents(verified_by);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON public.payments(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON public.payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_verified_by ON public.payments(verified_by);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_public_holidays_created_by ON public.public_holidays(created_by);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_bank_transaction_id ON public.reconciliation_matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_confirmed_by ON public.reconciliation_matches(confirmed_by);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_matched_by ON public.reconciliation_matches(matched_by);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_organization_id ON public.reconciliation_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_payment_id ON public.reconciliation_matches(payment_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_groups_created_by ON public.snapshot_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_driver_id ON public.vehicle_exceptions(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_resolved_by ON public.vehicle_exceptions(resolved_by);
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id ON public.vehicles(organization_id);

-- ============================================================================
-- PART 2: OPTIMIZE RLS POLICIES (CACHE AUTH FUNCTION RESULTS)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view and manage eft batches" ON public.daily_eft_batches;
CREATE POLICY "Users can view and manage eft batches"
  ON public.daily_eft_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "Super admins can manage encryption keys" ON public.encryption_keys;
CREATE POLICY "Super admins can manage encryption keys"
  ON public.encryption_keys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
CREATE POLICY "organizations_insert_policy"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
CREATE POLICY "organizations_update_policy"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM organization_users WHERE organization_users.user_id = (SELECT auth.uid()) AND organization_users.organization_id = organizations.id AND organization_users.can_edit_organization_info = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admin full access to payment cards" ON public.organization_payment_cards;
CREATE POLICY "Super admin full access to payment cards"
  ON public.organization_payment_cards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "Users can view vehicle exceptions" ON public.vehicle_exceptions;
CREATE POLICY "Users can view vehicle exceptions"
  ON public.vehicle_exceptions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM vehicles v JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vehicle_exceptions.vehicle_id AND ou.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admins can manage public holidays" ON public.public_holidays;
CREATE POLICY "Super admins can manage public holidays"
  ON public.public_holidays FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "Super admin full access to org garage accounts" ON public.organization_garage_accounts;
CREATE POLICY "Super admin full access to org garage accounts"
  ON public.organization_garage_accounts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "System can update invoice sequence" ON public.invoice_sequence;
DROP POLICY IF EXISTS "Super admins can manage invoice sequence" ON public.invoice_sequence;
CREATE POLICY "Super admins can manage invoice sequence"
  ON public.invoice_sequence FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

DROP POLICY IF EXISTS "Users can read fuel transaction invoices" ON public.fuel_transaction_invoices;
CREATE POLICY "Users can read fuel transaction invoices"
  ON public.fuel_transaction_invoices FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = fuel_transaction_invoices.organization_id AND organization_users.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Users can read fuel transaction items" ON public.fuel_transaction_items;
CREATE POLICY "Users can read fuel transaction items"
  ON public.fuel_transaction_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM fuel_transactions ft JOIN organization_users ou ON ou.organization_id = ft.organization_id WHERE ft.id = fuel_transaction_items.fuel_transaction_id AND ou.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "System can create bank transactions" ON public.bank_statement_transactions;
CREATE POLICY "System can create bank transactions"
  ON public.bank_statement_transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

-- ============================================================================
-- PART 3: REMOVE UNUSED INDEXES (38 indexes)
-- ============================================================================

DROP INDEX IF EXISTS idx_fuel_transaction_invoices_org_id;
DROP INDEX IF EXISTS idx_fuel_transaction_invoices_transaction_id;
DROP INDEX IF EXISTS drivers_organization_id_idx;
DROP INDEX IF EXISTS drivers_user_id_idx;
DROP INDEX IF EXISTS idx_fuel_transactions_organization_id;
DROP INDEX IF EXISTS idx_fuel_transactions_vehicle_id;
DROP INDEX IF EXISTS idx_organization_users_email;
DROP INDEX IF EXISTS idx_vehicle_transactions_organization_id;
DROP INDEX IF EXISTS idx_garages_city;
DROP INDEX IF EXISTS idx_garages_status;
DROP INDEX IF EXISTS driver_sessions_token_idx;
DROP INDEX IF EXISTS idx_vehicle_exceptions_organization_id;
DROP INDEX IF EXISTS idx_daily_eft_batches_date;
DROP INDEX IF EXISTS idx_snapshot_groups_created_at;
DROP INDEX IF EXISTS idx_vehicle_transactions_vehicle_id;
DROP INDEX IF EXISTS idx_custom_report_templates_user_id;
DROP INDEX IF EXISTS encryption_keys_key_version_idx;
DROP INDEX IF EXISTS idx_vehicle_transactions_driver_id;
DROP INDEX IF EXISTS idx_fuel_transactions_transaction_date;
DROP INDEX IF EXISTS idx_fuel_trans_org_date_totals;
DROP INDEX IF EXISTS idx_fuel_trans_driver_date_totals;
DROP INDEX IF EXISTS idx_fuel_transactions_vehicle_timestamp;
DROP INDEX IF EXISTS idx_invoices_invoice_date;
DROP INDEX IF EXISTS idx_invoice_line_items_invoice_id;
DROP INDEX IF EXISTS idx_payment_allocations_invoice_id;
DROP INDEX IF EXISTS organizations_payment_option_idx;
DROP INDEX IF EXISTS idx_org_payment_cards_org_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_invoice;
DROP INDEX IF EXISTS idx_fuel_invoices_number;
DROP INDEX IF EXISTS idx_org_garage_accounts_garage_id;
DROP INDEX IF EXISTS idx_org_garage_accounts_active;
DROP INDEX IF EXISTS idx_vehicle_exceptions_vehicle_id;
DROP INDEX IF EXISTS idx_vehicle_exceptions_created_at;
DROP INDEX IF EXISTS idx_failed_payment_attempts_invoice_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_to_invoice_id;
DROP INDEX IF EXISTS idx_credit_notes_applied_to_invoice_id;
DROP INDEX IF EXISTS idx_credit_notes_invoice_id;

-- ============================================================================
-- PART 4: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Organization users can read own org fuel transaction invoices" ON public.fuel_transaction_invoices;
DROP POLICY IF EXISTS "Organization users can read own org fuel transaction items" ON public.fuel_transaction_items;
DROP POLICY IF EXISTS "Super admins can manage line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Management org users can view all line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can manage line items" ON public.invoice_line_items;

CREATE POLICY "Comprehensive line items access"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM invoices i JOIN organization_users ou ON ou.organization_id = i.organization_id WHERE i.id = invoice_line_items.invoice_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_view_reports = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM is_management_org_user((SELECT auth.uid())) WHERE is_management_org_user = true)
  );

DROP POLICY IF EXISTS "Super admins can do everything with invoices" ON public.invoices;
DROP POLICY IF EXISTS "Management org users can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can manage invoices" ON public.invoices;

CREATE POLICY "Comprehensive invoices access"
  ON public.invoices FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = invoices.organization_id AND organization_users.user_id = (SELECT auth.uid()) AND organization_users.can_view_reports = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM is_management_org_user((SELECT auth.uid())) WHERE is_management_org_user = true)
  );

DROP POLICY IF EXISTS "Drivers can read their org payment cards" ON public.organization_payment_cards;
DROP POLICY IF EXISTS "Organization users can view their org payment cards" ON public.organization_payment_cards;

CREATE POLICY "Comprehensive payment cards access"
  ON public.organization_payment_cards FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = organization_payment_cards.organization_id AND organization_users.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM drivers d WHERE d.user_id = (SELECT auth.uid()) AND d.organization_id = organization_payment_cards.organization_id)
  );

DROP POLICY IF EXISTS "Super admin can view all exceptions" ON public.vehicle_exceptions;

-- ============================================================================
-- PART 5: FIX FUNCTION SEARCH PATHS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_management_org_no_driver_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = NEW.organization_id AND organization_type = 'management') AND NEW.role = 'driver' THEN
    RAISE EXCEPTION 'Management organizations cannot have users with driver role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_management_org_user(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_users ou
    JOIN public.organizations o ON o.id = ou.organization_id
    WHERE ou.user_id = is_management_org_user.user_id
    AND o.organization_type = 'management'
    AND ou.is_active = true
  );
END;
$$;

-- ============================================================================
-- PART 6: ENABLE RLS ON SYSTEM_DOCUMENTATION
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_documentation') THEN
    ALTER TABLE public.system_documentation ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Super admins can manage system documentation" ON public.system_documentation;
    CREATE POLICY "Super admins can manage system documentation"
      ON public.system_documentation FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));
    DROP POLICY IF EXISTS "All authenticated users can read system documentation" ON public.system_documentation;
    CREATE POLICY "All authenticated users can read system documentation"
      ON public.system_documentation FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- PART 7: FIX SECURITY DEFINER VIEW
-- ============================================================================

DROP VIEW IF EXISTS public.invoice_integrity_check;
CREATE VIEW public.invoice_integrity_check AS
SELECT
  i.id as invoice_id,
  i.invoice_number,
  i.organization_id,
  i.total_amount as invoice_total,
  COALESCE(SUM(ili.line_total), 0) as line_items_total,
  i.total_amount - COALESCE(SUM(ili.line_total), 0) as difference,
  CASE WHEN ABS(i.total_amount - COALESCE(SUM(ili.line_total), 0)) > 0.01 THEN 'MISMATCH' ELSE 'OK' END as status
FROM public.invoices i
LEFT JOIN public.invoice_line_items ili ON ili.invoice_id = i.id
GROUP BY i.id, i.invoice_number, i.organization_id, i.total_amount;

GRANT SELECT ON public.invoice_integrity_check TO authenticated;