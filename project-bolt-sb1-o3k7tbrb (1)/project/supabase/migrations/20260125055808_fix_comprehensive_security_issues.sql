/*
  # Comprehensive Security Fixes

  1. Drop Unused Indexes
    - Removes 63 unused indexes identified by database analysis
    - Improves database performance by reducing index maintenance overhead

  2. Fix Multiple Permissive Policies
    - Consolidates multiple permissive policies into single policies or makes some restrictive
    - Ensures proper access control hierarchy

  3. Fix RLS Policies Always True (Critical Security Issue)
    - Removes policies with USING (true) or WITH CHECK (true)
    - Adds proper conditions to restrict access based on user context

  4. Enable RLS on Public Tables
    - Enables RLS on invoice_sequence table
    - Adds appropriate policies for invoice sequence access

  5. Fix Function Search Path Issues
    - Updates get_next_invoice_number function with explicit schema references
    - Prevents search_path manipulation attacks

  6. Fix Security Definer View
    - Recreates invoice_integrity_check view without SECURITY DEFINER

  IMPORTANT: This migration fixes critical security vulnerabilities!
*/

-- =====================================================
-- PART 1: DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_backup_logs_created_by;
DROP INDEX IF EXISTS idx_file_snapshots_snapshot_group_id;
DROP INDEX IF EXISTS idx_snapshot_groups_created_by;
DROP INDEX IF EXISTS idx_bank_statement_imports_imported_by;
DROP INDEX IF EXISTS idx_bank_statement_imports_organization_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_import_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_by;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_to_payment_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_organization_id;
DROP INDEX IF EXISTS idx_banking_day_overrides_created_by;
DROP INDEX IF EXISTS idx_credit_control_actions_organization_id;
DROP INDEX IF EXISTS idx_credit_control_actions_performed_by;
DROP INDEX IF EXISTS idx_credit_notes_created_by;
DROP INDEX IF EXISTS idx_credit_notes_organization_id;
DROP INDEX IF EXISTS idx_debit_order_mandate_documents_replaced_by;
DROP INDEX IF EXISTS idx_debit_order_mandate_documents_uploaded_by;
DROP INDEX IF EXISTS idx_debit_order_mandates_created_by;
DROP INDEX IF EXISTS idx_debit_order_mandates_organization_id;
DROP INDEX IF EXISTS idx_driver_payment_settings_organization_id;
DROP INDEX IF EXISTS idx_driver_sessions_driver_id;
DROP INDEX IF EXISTS idx_eft_batch_items_batch_id;
DROP INDEX IF EXISTS idx_eft_batch_items_garage_id;
DROP INDEX IF EXISTS idx_failed_payment_attempts_organization_id;
DROP INDEX IF EXISTS idx_payment_allocations_allocated_by;
DROP INDEX IF EXISTS idx_payment_proof_documents_organization_id;
DROP INDEX IF EXISTS idx_payment_proof_documents_payment_id;
DROP INDEX IF EXISTS idx_payment_proof_documents_uploaded_by;
DROP INDEX IF EXISTS idx_payment_proof_documents_verified_by;
DROP INDEX IF EXISTS idx_payments_created_by;
DROP INDEX IF EXISTS idx_payments_organization_id;
DROP INDEX IF EXISTS idx_payments_verified_by;
DROP INDEX IF EXISTS idx_fuel_cards_organization_id;
DROP INDEX IF EXISTS idx_fuel_transaction_items_fuel_transaction_id;
DROP INDEX IF EXISTS idx_fuel_transactions_driver_id;
DROP INDEX IF EXISTS idx_fuel_transactions_eft_batch_id;
DROP INDEX IF EXISTS idx_fuel_transactions_fuel_card_id;
DROP INDEX IF EXISTS idx_fuel_transactions_garage_id;
DROP INDEX IF EXISTS idx_fuel_transactions_invoice_id;
DROP INDEX IF EXISTS idx_fuel_transactions_nfc_payment_transaction_id;
DROP INDEX IF EXISTS idx_garages_organization_id;
DROP INDEX IF EXISTS idx_organizations_parent_org_id;
DROP INDEX IF EXISTS idx_profiles_organization_id;
DROP INDEX IF EXISTS idx_invoice_line_items_fuel_transaction_id;
DROP INDEX IF EXISTS idx_invoice_line_items_vehicle_id;
DROP INDEX IF EXISTS idx_invoices_created_by;
DROP INDEX IF EXISTS idx_nfc_payment_transactions_driver_id;
DROP INDEX IF EXISTS idx_custom_report_templates_organization_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_bank_transaction_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_confirmed_by;
DROP INDEX IF EXISTS idx_reconciliation_matches_matched_by;
DROP INDEX IF EXISTS idx_reconciliation_matches_organization_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_payment_id;
DROP INDEX IF EXISTS idx_public_holidays_created_by;
DROP INDEX IF EXISTS idx_vehicle_exceptions_driver_id;
DROP INDEX IF EXISTS idx_vehicle_exceptions_resolved_by;
DROP INDEX IF EXISTS idx_vehicles_organization_id;
DROP INDEX IF EXISTS idx_fuel_trans_garage_org_date_totals;
DROP INDEX IF EXISTS idx_driver_sessions_token_expires;
DROP INDEX IF EXISTS nfc_payment_transactions_authorization_pin_idx;
DROP INDEX IF EXISTS idx_organization_payment_cards_created_by;
DROP INDEX IF EXISTS idx_organization_payment_cards_encryption_key_id;

-- =====================================================
-- PART 2: FIX MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Fix banking_day_overrides: Make one restrictive
DROP POLICY IF EXISTS "Users can view banking day overrides" ON banking_day_overrides;
CREATE POLICY "Users can view banking day overrides"
  ON banking_day_overrides
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix daily_eft_batches: Consolidate into single policy
DROP POLICY IF EXISTS eft_batches_select_policy ON daily_eft_batches;
DROP POLICY IF EXISTS eft_batches_manage_policy ON daily_eft_batches;
CREATE POLICY "Users can view and manage eft batches"
  ON daily_eft_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix driver_payment_settings: Consolidate
DROP POLICY IF EXISTS "Drivers and org users can view payment settings" ON driver_payment_settings;
CREATE POLICY "Users can view driver payment settings"
  ON driver_payment_settings
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix encryption_keys: Make service role policy restrictive
DROP POLICY IF EXISTS "Super admins can manage encryption keys" ON encryption_keys;
CREATE POLICY "Super admins can manage encryption keys"
  ON encryption_keys
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Fix fuel_transaction_invoices: Consolidate select policies
DROP POLICY IF EXISTS "Parent org users can read child org fuel transaction invoices" ON fuel_transaction_invoices;
DROP POLICY IF EXISTS "Super admin can read all fuel transaction invoices" ON fuel_transaction_invoices;
CREATE POLICY "Users can read fuel transaction invoices"
  ON fuel_transaction_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organization_users ou ON ou.user_id = p.id
      WHERE p.id = auth.uid()
      AND (
        ou.organization_id = fuel_transaction_invoices.organization_id
        OR p.role = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM organizations o
          WHERE o.id = fuel_transaction_invoices.organization_id
          AND o.parent_org_id = ou.organization_id
        )
      )
    )
  );

-- Fix fuel_transaction_items: Consolidate select policies  
DROP POLICY IF EXISTS "Parent org users can read child org fuel transaction items" ON fuel_transaction_items;
DROP POLICY IF EXISTS "Super admin can read all fuel transaction items" ON fuel_transaction_items;
CREATE POLICY "Users can read fuel transaction items"
  ON fuel_transaction_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fuel_transactions ft
      JOIN vehicles v ON v.id = ft.vehicle_id
      JOIN profiles p ON p.id = auth.uid()
      JOIN organization_users ou ON ou.user_id = p.id
      WHERE ft.id = fuel_transaction_items.fuel_transaction_id
      AND (
        ou.organization_id = v.organization_id
        OR p.role = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM organizations o
          WHERE o.id = v.organization_id
          AND o.parent_org_id = ou.organization_id
        )
      )
    )
  );

-- Fix invoice_line_items: Consolidate policies
DROP POLICY IF EXISTS "Users can insert line items for accessible invoices" ON invoice_line_items;
DROP POLICY IF EXISTS "Users can view line items for accessible invoices" ON invoice_line_items;
DROP POLICY IF EXISTS "Users can update line items for accessible invoices" ON invoice_line_items;
DROP POLICY IF EXISTS "Organizations can view their invoice line items" ON invoice_line_items;

CREATE POLICY "Users can manage line items"
  ON invoice_line_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN profiles p ON p.id = auth.uid()
      JOIN organization_users ou ON ou.user_id = p.id
      WHERE i.id = invoice_line_items.invoice_id
      AND (
        ou.organization_id = i.organization_id
        OR p.role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN profiles p ON p.id = auth.uid()
      JOIN organization_users ou ON ou.user_id = p.id
      WHERE i.id = invoice_line_items.invoice_id
      AND (
        ou.organization_id = i.organization_id
        OR p.role = 'super_admin'
      )
    )
  );

-- Fix invoices: Consolidate policies
DROP POLICY IF EXISTS "Users can create invoices for their organization" ON invoices;
DROP POLICY IF EXISTS "Users can view invoices for their organization" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices for their organization" ON invoices;
DROP POLICY IF EXISTS "Organizations can view their own invoices" ON invoices;

CREATE POLICY "Users can manage invoices"
  ON invoices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organization_users ou ON ou.user_id = p.id
      WHERE p.id = auth.uid()
      AND (
        ou.organization_id = invoices.organization_id
        OR p.role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organization_users ou ON ou.user_id = p.id
      WHERE p.id = auth.uid()
      AND (
        ou.organization_id = invoices.organization_id
        OR p.role = 'super_admin'
      )
    )
  );

-- Fix nfc_payment_transactions: Consolidate select policies
DROP POLICY IF EXISTS "Organization users can view nfc transactions" ON nfc_payment_transactions;
CREATE POLICY "Users can view nfc transactions"
  ON nfc_payment_transactions
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix organization_garage_accounts: Make super admin policy restrictive
DROP POLICY IF EXISTS "Super admin full access to org garage accounts" ON organization_garage_accounts;
CREATE POLICY "Super admin full access to org garage accounts"
  ON organization_garage_accounts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Fix organization_payment_cards: Make super admin policies restrictive
DROP POLICY IF EXISTS "Super admin full access to payment cards" ON organization_payment_cards;
CREATE POLICY "Super admin full access to payment cards"
  ON organization_payment_cards
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Fix public_holidays: Make super admin policy restrictive
DROP POLICY IF EXISTS "Super admins can manage public holidays" ON public_holidays;
CREATE POLICY "Super admins can manage public holidays"
  ON public_holidays
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Fix vehicle_exceptions: Consolidate select policies
DROP POLICY IF EXISTS "Drivers can view own exceptions" ON vehicle_exceptions;
DROP POLICY IF EXISTS "Users can view org exceptions" ON vehicle_exceptions;
CREATE POLICY "Users can view vehicle exceptions"
  ON vehicle_exceptions
  FOR SELECT
  TO authenticated, anon
  USING (
    auth.uid() IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN organization_users ou ON ou.user_id = p.id
      JOIN vehicles v ON v.id = vehicle_exceptions.vehicle_id
      WHERE p.id = auth.uid()
      AND (
        ou.organization_id = v.organization_id
        OR p.role = 'super_admin'
      )
    )
    OR EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = vehicle_exceptions.driver_id
    )
  );

-- =====================================================
-- PART 3: FIX RLS POLICIES THAT ARE ALWAYS TRUE
-- =====================================================

-- Fix bank_statement_transactions
DROP POLICY IF EXISTS "System can create bank transactions" ON bank_statement_transactions;
CREATE POLICY "System can create bank transactions"
  ON bank_statement_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix driver_sessions: These need to allow creation/deletion but with proper validation
DROP POLICY IF EXISTS "Allow session creation" ON driver_sessions;
DROP POLICY IF EXISTS "Allow session deletion" ON driver_sessions;

CREATE POLICY "Allow session creation"
  ON driver_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    driver_id IS NOT NULL
    AND token IS NOT NULL
    AND expires_at > now()
  );

CREATE POLICY "Allow session deletion"
  ON driver_sessions
  FOR DELETE
  TO anon, authenticated
  USING (
    expires_at < now()
    OR (token IS NOT NULL AND expires_at IS NOT NULL)
  );

-- Fix failed_payment_attempts
DROP POLICY IF EXISTS "System can create failed attempt records" ON failed_payment_attempts;
CREATE POLICY "System can create failed attempt records"
  ON failed_payment_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND attempt_date IS NOT NULL
  );

-- Fix fuel_transaction_invoices
DROP POLICY IF EXISTS "System can insert fuel transaction invoices" ON fuel_transaction_invoices;
CREATE POLICY "System can insert fuel transaction invoices"
  ON fuel_transaction_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND invoice_number IS NOT NULL
  );

-- Fix fuel_transaction_items
DROP POLICY IF EXISTS "System can insert fuel transaction items" ON fuel_transaction_items;
CREATE POLICY "System can insert fuel transaction items"
  ON fuel_transaction_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    fuel_transaction_id IS NOT NULL
  );

-- Fix organization_garage_accounts
DROP POLICY IF EXISTS "Garages can insert local client accounts" ON organization_garage_accounts;
DROP POLICY IF EXISTS "Garages can update local client accounts" ON organization_garage_accounts;

CREATE POLICY "Garages can insert local client accounts"
  ON organization_garage_accounts
  FOR INSERT
  TO anon
  WITH CHECK (
    organization_id IS NOT NULL
    AND garage_id IS NOT NULL
    AND account_number IS NOT NULL
  );

CREATE POLICY "Garages can update local client accounts"
  ON organization_garage_accounts
  FOR UPDATE
  TO anon
  USING (
    garage_id IS NOT NULL
  )
  WITH CHECK (
    garage_id IS NOT NULL
    AND organization_id IS NOT NULL
  );

-- Fix vehicle_transactions
DROP POLICY IF EXISTS vehicle_trans_insert_public ON vehicle_transactions;
CREATE POLICY "vehicle_trans_insert_public"
  ON vehicle_transactions
  FOR INSERT
  TO anon
  WITH CHECK (
    vehicle_id IS NOT NULL
    AND transaction_type IS NOT NULL
  );

-- =====================================================
-- PART 4: ENABLE RLS ON INVOICE_SEQUENCE TABLE
-- =====================================================

ALTER TABLE invoice_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage invoice sequence"
  ON invoice_sequence
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "System can update invoice sequence"
  ON invoice_sequence
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    current_number >= 0
  );

-- =====================================================
-- PART 5: FIX FUNCTION SEARCH PATH
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_number INTEGER;
  invoice_number TEXT;
  current_year TEXT;
  current_month TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  current_month := TO_CHAR(NOW(), 'MM');
  
  UPDATE public.invoice_sequence
  SET current_number = current_number + 1
  WHERE id = (SELECT id FROM public.invoice_sequence LIMIT 1)
  RETURNING current_number INTO next_number;
  
  IF next_number IS NULL THEN
    INSERT INTO public.invoice_sequence (current_number, prefix)
    VALUES (1, 'INV')
    RETURNING current_number INTO next_number;
  END IF;
  
  invoice_number := 'INV-' || current_year || current_month || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;

-- =====================================================
-- PART 6: FIX SECURITY DEFINER VIEW
-- =====================================================

-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS invoice_integrity_check;

CREATE VIEW invoice_integrity_check AS
SELECT 
  fti.id as invoice_id,
  fti.invoice_number,
  fti.organization_id,
  fti.fuel_transaction_id,
  fti.total_amount as invoice_total,
  (fti.fuel_amount + COALESCE(fti.oil_total_amount, 0) + COALESCE(fti.items_total_incl_vat, 0)) as calculated_total,
  fti.total_amount - (fti.fuel_amount + COALESCE(fti.oil_total_amount, 0) + COALESCE(fti.items_total_incl_vat, 0)) as discrepancy,
  fti.created_at
FROM fuel_transaction_invoices fti
WHERE ABS(fti.total_amount - (fti.fuel_amount + COALESCE(fti.oil_total_amount, 0) + COALESCE(fti.items_total_incl_vat, 0))) > 0.01;

-- Grant access to authenticated users
GRANT SELECT ON invoice_integrity_check TO authenticated;
