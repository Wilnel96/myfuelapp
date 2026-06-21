/*
  # Fix Security and Performance Issues
  
  1. Index Improvements
    - Add missing index on fuel_transactions.invoice_id foreign key
    - Drop duplicate index (keeping idx_invoices_organization_id, dropping idx_invoices_org_id)
    - Drop unused indexes that are not needed
  
  2. RLS Policy Optimizations
    - Fix all RLS policies to use (select auth.uid()) instead of auth.uid()
    - This prevents re-evaluation for each row, improving query performance
    - Affected tables: fuel_transaction_invoices, drivers, invoices, invoice_line_items, invoice_sequences
  
  3. Function Security
    - Set explicit search_path for all functions to prevent search_path manipulation attacks
  
  4. Notes
    - Some unused indexes are kept for potential future use
    - Multiple permissive policies are intentional and provide different access patterns
    - Auth DB connection strategy and leaked password protection require manual configuration in Supabase dashboard
*/

-- =====================================================
-- 1. ADD MISSING INDEX FOR FOREIGN KEY
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_invoice_id 
ON fuel_transactions(invoice_id);

-- =====================================================
-- 2. DROP DUPLICATE INDEX
-- =====================================================

DROP INDEX IF EXISTS idx_invoices_org_id;

-- =====================================================
-- 3. DROP SELECTED UNUSED INDEXES
-- =====================================================
-- Drop indexes that are truly not needed and unlikely to be used

-- These are for old/deprecated features
DROP INDEX IF EXISTS idx_fuel_transaction_invoices_invoice_date;
DROP INDEX IF EXISTS idx_fuel_transaction_invoices_email_sent;

-- Driver sessions are not actively used
DROP INDEX IF EXISTS driver_sessions_driver_id_idx;
DROP INDEX IF EXISTS driver_sessions_expires_at_idx;

-- File snapshots group queries are rare
DROP INDEX IF EXISTS idx_file_snapshots_group_id;

-- Payment-related indexes for features not yet implemented
DROP INDEX IF EXISTS idx_organizations_payment_method;
DROP INDEX IF EXISTS idx_organizations_payment_date;
DROP INDEX IF EXISTS idx_debit_order_mandates_org_id;
DROP INDEX IF EXISTS idx_debit_order_mandates_status;
DROP INDEX IF EXISTS idx_debit_order_mandates_reference;
DROP INDEX IF EXISTS idx_debit_order_mandate_docs_mandate_id;
DROP INDEX IF EXISTS idx_payments_org_id;
DROP INDEX IF EXISTS idx_payments_date;
DROP INDEX IF EXISTS idx_payments_verified;
DROP INDEX IF EXISTS idx_payment_allocations_payment_id;
DROP INDEX IF EXISTS idx_failed_attempts_org_id;
DROP INDEX IF EXISTS idx_failed_attempts_status;
DROP INDEX IF EXISTS idx_credit_notes_org_id;
DROP INDEX IF EXISTS idx_payment_proof_org_id;
DROP INDEX IF EXISTS idx_payment_proof_payment_id;
DROP INDEX IF EXISTS idx_payment_proof_status;
DROP INDEX IF EXISTS idx_bank_imports_org_id;
DROP INDEX IF EXISTS idx_bank_imports_dates;
DROP INDEX IF EXISTS idx_bank_transactions_import_id;
DROP INDEX IF EXISTS idx_bank_transactions_org_id;
DROP INDEX IF EXISTS idx_bank_transactions_matched;
DROP INDEX IF EXISTS idx_bank_transactions_date;
DROP INDEX IF EXISTS idx_reconciliation_matches_org_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_bank_trans;
DROP INDEX IF EXISTS idx_reconciliation_matches_payment;
DROP INDEX IF EXISTS idx_public_holidays_date;
DROP INDEX IF EXISTS idx_public_holidays_active;
DROP INDEX IF EXISTS idx_banking_overrides_date;
DROP INDEX IF EXISTS idx_credit_control_actions_organization_id;
DROP INDEX IF EXISTS idx_credit_control_actions_action_date;

-- "created_by" and "verified_by" indexes for audit fields
DROP INDEX IF EXISTS idx_invoices_created_by;
DROP INDEX IF EXISTS idx_organization_payment_cards_created_by;
DROP INDEX IF EXISTS idx_payment_allocations_allocated_by;
DROP INDEX IF EXISTS idx_payment_proof_documents_uploaded_by;
DROP INDEX IF EXISTS idx_payment_proof_documents_verified_by;
DROP INDEX IF EXISTS idx_backup_logs_created_by;
DROP INDEX IF EXISTS idx_bank_statement_imports_imported_by;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_by;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_to_payment_id;
DROP INDEX IF EXISTS idx_banking_day_overrides_created_by;
DROP INDEX IF EXISTS idx_credit_control_actions_performed_by;
DROP INDEX IF EXISTS idx_credit_notes_created_by;
DROP INDEX IF EXISTS idx_debit_order_mandate_documents_replaced_by;
DROP INDEX IF EXISTS idx_debit_order_mandate_documents_uploaded_by;
DROP INDEX IF EXISTS idx_debit_order_mandates_created_by;
DROP INDEX IF EXISTS idx_payments_created_by;
DROP INDEX IF EXISTS idx_payments_verified_by;
DROP INDEX IF EXISTS idx_public_holidays_created_by;
DROP INDEX IF EXISTS idx_reconciliation_matches_confirmed_by;
DROP INDEX IF EXISTS idx_reconciliation_matches_matched_by;
DROP INDEX IF EXISTS idx_snapshot_groups_created_by;
DROP INDEX IF EXISTS idx_vehicle_exceptions_resolved_by;

-- =====================================================
-- 4. FIX RLS POLICIES - FUEL_TRANSACTION_INVOICES
-- =====================================================

DROP POLICY IF EXISTS "Organization users can read own org fuel transaction invoices" ON fuel_transaction_invoices;
CREATE POLICY "Organization users can read own org fuel transaction invoices" 
ON fuel_transaction_invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_users.user_id = (select auth.uid())
    AND organization_users.organization_id = fuel_transaction_invoices.organization_id
    AND organization_users.is_active = true
  )
);

DROP POLICY IF EXISTS "Parent org users can read child org fuel transaction invoices" ON fuel_transaction_invoices;
CREATE POLICY "Parent org users can read child org fuel transaction invoices" 
ON fuel_transaction_invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_users ou
    JOIN organizations child_org ON child_org.id = fuel_transaction_invoices.organization_id
    WHERE ou.user_id = (select auth.uid())
    AND ou.organization_id = child_org.parent_org_id
    AND ou.is_active = true
  )
);

DROP POLICY IF EXISTS "Super admin can read all fuel transaction invoices" ON fuel_transaction_invoices;
CREATE POLICY "Super admin can read all fuel transaction invoices" 
ON fuel_transaction_invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.role = 'super_admin'
  )
);

-- =====================================================
-- 5. FIX RLS POLICIES - DRIVERS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view drivers" ON drivers;
CREATE POLICY "Authenticated users can view drivers" 
ON drivers FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = (select auth.uid())
  )
  OR user_id = (select auth.uid())
  OR organization_id IN (
    SELECT id FROM organizations 
    WHERE parent_org_id IN (
      SELECT organization_id FROM profiles WHERE id = (select auth.uid())
    )
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = (select auth.uid()) AND role = 'super_admin'
  )
);

-- =====================================================
-- 6. FIX RLS POLICIES - INVOICES
-- =====================================================

DROP POLICY IF EXISTS "Management org users can view all invoices" ON invoices;
CREATE POLICY "Management org users can view all invoices" 
ON invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = (select auth.uid())
    AND o.name = 'Management Organization'
  )
);

DROP POLICY IF EXISTS "Organizations can view their own invoices" ON invoices;
CREATE POLICY "Organizations can view their own invoices" 
ON invoices FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Super admins can do everything with invoices" ON invoices;
CREATE POLICY "Super admins can do everything with invoices" 
ON invoices FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = (select auth.uid())
    AND p.role = 'super_admin'
    AND o.name = 'Super Admin Organization'
  )
);

-- =====================================================
-- 7. FIX RLS POLICIES - INVOICE_LINE_ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Management org users can view all line items" ON invoice_line_items;
CREATE POLICY "Management org users can view all line items" 
ON invoice_line_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = (select auth.uid())
    AND o.name = 'Management Organization'
  )
);

DROP POLICY IF EXISTS "Organizations can view their invoice line items" ON invoice_line_items;
CREATE POLICY "Organizations can view their invoice line items" 
ON invoice_line_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_line_items.invoice_id
    AND i.organization_id IN (
      SELECT organization_id FROM profiles WHERE id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Super admins can manage line items" ON invoice_line_items;
CREATE POLICY "Super admins can manage line items" 
ON invoice_line_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = (select auth.uid())
    AND p.role = 'super_admin'
    AND o.name = 'Super Admin Organization'
  )
);

-- =====================================================
-- 8. FIX RLS POLICIES - INVOICE_SEQUENCES
-- =====================================================

DROP POLICY IF EXISTS "Management org can view invoice sequences" ON invoice_sequences;
CREATE POLICY "Management org can view invoice sequences" 
ON invoice_sequences FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = (select auth.uid())
    AND o.name = 'Management Organization'
  )
);

DROP POLICY IF EXISTS "Super admins can manage invoice sequences" ON invoice_sequences;
CREATE POLICY "Super admins can manage invoice sequences" 
ON invoice_sequences FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = (select auth.uid())
    AND p.role = 'super_admin'
    AND o.name = 'Super Admin Organization'
  )
);

-- =====================================================
-- 9. FIX FUNCTION SEARCH PATHS
-- =====================================================

ALTER FUNCTION auto_grant_permissions_for_main_users() 
SET search_path = public, pg_temp;

ALTER FUNCTION generate_fuel_invoice_number() 
SET search_path = public, pg_temp;

ALTER FUNCTION sync_user_title_with_flags() 
SET search_path = public, pg_temp;

ALTER FUNCTION check_driver_license_qualifies(p_driver_license_code text, p_vehicle_license_required text) 
SET search_path = public, pg_temp;

ALTER FUNCTION toggle_secondary_main_user(user_id_to_toggle uuid) 
SET search_path = public, pg_temp;

ALTER FUNCTION auto_grant_permissions_to_secondary_main_user() 
SET search_path = public, pg_temp;

ALTER FUNCTION sync_title_with_flags() 
SET search_path = public, pg_temp;
