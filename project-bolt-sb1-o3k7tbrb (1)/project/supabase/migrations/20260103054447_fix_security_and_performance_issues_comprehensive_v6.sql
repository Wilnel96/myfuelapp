/*
  # Fix Security and Performance Issues - Comprehensive Fix v6
  
  This migration addresses multiple security and performance issues identified in the database:
  
  ## 1. Missing Foreign Key Indexes
  - Add indexes for `organization_payment_cards.created_by`
  - Add indexes for `organization_payment_cards.encryption_key_id`
  
  ## 2. RLS Performance Optimization
  - Fix all RLS policies to use `(select auth.uid())` instead of `auth.uid()` directly
  - This prevents re-evaluation on each row and significantly improves query performance
  - Affected tables:
    - encryption_keys
    - organization_payment_cards
    - organization_garage_accounts
  
  ## 3. Drop Duplicate Indexes
  - Drop duplicate indexes to save storage and improve write performance
  
  ## 4. Drop Unused Indexes
  - Remove indexes that are never used in queries to improve write performance
  
  ## 5. Fix Function Search Paths
  - Set explicit search_path for functions to prevent security issues
*/

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_organization_payment_cards_created_by 
  ON organization_payment_cards(created_by);

CREATE INDEX IF NOT EXISTS idx_organization_payment_cards_encryption_key_id 
  ON organization_payment_cards(encryption_key_id);

-- ============================================================================
-- PART 2: Fix RLS Policies for Performance (Auth Function Initialization)
-- ============================================================================

-- Fix encryption_keys policies
DROP POLICY IF EXISTS "Service role can manage encryption keys" ON encryption_keys;
CREATE POLICY "Service role can manage encryption keys"
  ON encryption_keys
  FOR ALL
  TO authenticated
  USING (
    (select auth.uid()) IN (
      SELECT id 
      FROM profiles 
      WHERE organization_id = (SELECT id FROM organizations WHERE is_management_org = true LIMIT 1)
    )
  );

-- Fix organization_payment_cards policies
DROP POLICY IF EXISTS "Drivers can read their org payment cards" ON organization_payment_cards;
CREATE POLICY "Drivers can read their org payment cards"
  ON organization_payment_cards
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM drivers 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Main users can delete their org payment cards" ON organization_payment_cards;
CREATE POLICY "Main users can delete their org payment cards"
  ON organization_payment_cards
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid()) 
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

DROP POLICY IF EXISTS "Organization users can view their org payment cards" ON organization_payment_cards;
CREATE POLICY "Organization users can view their org payment cards"
  ON organization_payment_cards
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admin full access to payment cards" ON organization_payment_cards;
CREATE POLICY "Super admin full access to payment cards"
  ON organization_payment_cards
  FOR ALL
  TO authenticated
  USING (
    (select auth.uid()) IN (
      SELECT id 
      FROM profiles 
      WHERE organization_id = (SELECT id FROM organizations WHERE is_management_org = true LIMIT 1)
    )
  );

-- Fix organization_garage_accounts policies
DROP POLICY IF EXISTS "Organization users can view their garage accounts" ON organization_garage_accounts;
CREATE POLICY "Organization users can view their garage accounts"
  ON organization_garage_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admin full access to org garage accounts" ON organization_garage_accounts;
CREATE POLICY "Super admin full access to org garage accounts"
  ON organization_garage_accounts
  FOR ALL
  TO authenticated
  USING (
    (select auth.uid()) IN (
      SELECT id 
      FROM profiles 
      WHERE organization_id = (SELECT id FROM organizations WHERE is_management_org = true LIMIT 1)
    )
  );

-- ============================================================================
-- PART 3: Drop Duplicate Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_fuel_invoices_transaction;
DROP INDEX IF EXISTS idx_organizations_payment_option;

-- ============================================================================
-- PART 4: Drop Unused Indexes (Carefully Selected)
-- ============================================================================

-- Payment-related unused indexes
DROP INDEX IF EXISTS organizations_payment_option_idx;
DROP INDEX IF EXISTS organizations_payment_config_idx;
DROP INDEX IF EXISTS organizations_payment_option_terms_idx;
DROP INDEX IF EXISTS invoices_payment_option_idx;

-- Mock location index
DROP INDEX IF EXISTS idx_fuel_transactions_mock_location;

-- Template and settings indexes
DROP INDEX IF EXISTS idx_custom_report_templates_organization_id;
DROP INDEX IF EXISTS idx_driver_payment_settings_organization_id;

-- Batch processing indexes
DROP INDEX IF EXISTS idx_eft_batch_items_batch_id;
DROP INDEX IF EXISTS idx_eft_batch_items_garage_id;

-- Card indexes
DROP INDEX IF EXISTS idx_fuel_cards_organization_id;

-- Transaction item indexes
DROP INDEX IF EXISTS idx_fuel_transaction_items_fuel_transaction_id;
DROP INDEX IF EXISTS idx_invoice_line_items_fuel_transaction_id;
DROP INDEX IF EXISTS idx_invoice_line_items_vehicle_id;

-- Driver-specific transaction indexes
DROP INDEX IF EXISTS idx_fuel_transactions_driver_id;
DROP INDEX IF EXISTS idx_fuel_transactions_eft_batch_id;
DROP INDEX IF EXISTS idx_fuel_transactions_fuel_card_id;
DROP INDEX IF EXISTS idx_fuel_transactions_garage_id;
DROP INDEX IF EXISTS idx_fuel_transactions_invoice_id;
DROP INDEX IF EXISTS idx_fuel_transactions_nfc_payment_transaction_id;

-- Organization-related indexes
DROP INDEX IF EXISTS idx_garages_organization_id;
DROP INDEX IF EXISTS idx_organizations_parent_org_id;
DROP INDEX IF EXISTS idx_profiles_organization_id;
DROP INDEX IF EXISTS idx_vehicles_organization_id;

-- NFC payment indexes
DROP INDEX IF EXISTS idx_nfc_payment_transactions_driver_id;
DROP INDEX IF EXISTS idx_nfc_payment_transactions_organization_card_id;

-- Vehicle exception indexes
DROP INDEX IF EXISTS idx_vehicle_exceptions_driver_id;

-- Vehicle transaction indexes
DROP INDEX IF EXISTS idx_vehicle_transactions_organization_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_related_transaction_id;

-- Backup and statement indexes
DROP INDEX IF EXISTS idx_backup_logs_created_by;
DROP INDEX IF EXISTS idx_bank_statement_imports_imported_by;
DROP INDEX IF EXISTS idx_bank_statement_imports_organization_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_import_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_by;
DROP INDEX IF EXISTS idx_bank_statement_transactions_matched_to_payment_id;
DROP INDEX IF EXISTS idx_bank_statement_transactions_organization_id;
DROP INDEX IF EXISTS idx_banking_day_overrides_created_by;

-- Credit control indexes
DROP INDEX IF EXISTS idx_credit_control_actions_organization_id;
DROP INDEX IF EXISTS idx_credit_control_actions_performed_by;
DROP INDEX IF EXISTS idx_credit_notes_created_by;
DROP INDEX IF EXISTS idx_credit_notes_organization_id;

-- Debit order indexes
DROP INDEX IF EXISTS idx_debit_order_mandate_documents_replaced_by;
DROP INDEX IF EXISTS idx_debit_order_mandate_documents_uploaded_by;
DROP INDEX IF EXISTS idx_debit_order_mandates_created_by;
DROP INDEX IF EXISTS idx_debit_order_mandates_organization_id;

-- Session indexes
DROP INDEX IF EXISTS idx_driver_sessions_driver_id;

-- Payment failure indexes
DROP INDEX IF EXISTS idx_failed_payment_attempts_organization_id;

-- File snapshot indexes
DROP INDEX IF EXISTS idx_file_snapshots_snapshot_group_id;

-- Reconciliation indexes
DROP INDEX IF EXISTS idx_reconciliation_matches_confirmed_by;
DROP INDEX IF EXISTS idx_reconciliation_matches_matched_by;
DROP INDEX IF EXISTS idx_reconciliation_matches_organization_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_bank_transaction_id;
DROP INDEX IF EXISTS idx_reconciliation_matches_payment_id;

-- Invoice indexes
DROP INDEX IF EXISTS idx_invoices_created_by;

-- Payment indexes
DROP INDEX IF EXISTS idx_payment_allocations_allocated_by;
DROP INDEX IF EXISTS idx_payment_proof_documents_organization_id;
DROP INDEX IF EXISTS idx_payment_proof_documents_payment_id;
DROP INDEX IF EXISTS idx_payment_proof_documents_uploaded_by;
DROP INDEX IF EXISTS idx_payment_proof_documents_verified_by;
DROP INDEX IF EXISTS idx_payments_created_by;
DROP INDEX IF EXISTS idx_payments_organization_id;
DROP INDEX IF EXISTS idx_payments_verified_by;

-- Holiday indexes
DROP INDEX IF EXISTS idx_public_holidays_created_by;

-- Snapshot indexes
DROP INDEX IF EXISTS idx_snapshot_groups_created_by;

-- Vehicle exception indexes
DROP INDEX IF EXISTS idx_vehicle_exceptions_resolved_by;
DROP INDEX IF EXISTS idx_vehicle_exceptions_vehicle;
DROP INDEX IF EXISTS idx_vehicle_exceptions_org;

-- Composite indexes that are unused
DROP INDEX IF EXISTS idx_vehicles_org_status;
DROP INDEX IF EXISTS idx_vehicles_org_reg_number;
DROP INDEX IF EXISTS idx_vehicles_fuel_type;
DROP INDEX IF EXISTS idx_vehicles_last_service;
DROP INDEX IF EXISTS idx_drivers_org_status;
DROP INDEX IF EXISTS idx_drivers_org_id_number;
DROP INDEX IF EXISTS idx_drivers_license_expiry;
DROP INDEX IF EXISTS idx_drivers_prdp_expiry;
DROP INDEX IF EXISTS idx_fuel_transactions_org_date;
DROP INDEX IF EXISTS idx_fuel_transactions_vehicle_date;
DROP INDEX IF EXISTS idx_fuel_transactions_driver_date;
DROP INDEX IF EXISTS idx_fuel_transactions_garage_date;
DROP INDEX IF EXISTS idx_vehicle_transactions_vehicle_type;
DROP INDEX IF EXISTS idx_vehicle_transactions_org_date;
DROP INDEX IF EXISTS idx_vehicle_transactions_driver_type;
DROP INDEX IF EXISTS idx_org_users_org_active;
DROP INDEX IF EXISTS idx_org_users_user_org;
DROP INDEX IF EXISTS idx_org_users_role;
DROP INDEX IF EXISTS idx_org_payment_cards_active;
DROP INDEX IF EXISTS idx_org_payment_cards_default;
DROP INDEX IF EXISTS idx_garages_price_zone;
DROP INDEX IF EXISTS idx_garages_fuel_brand;
DROP INDEX IF EXISTS idx_fuel_invoices_org_date;
DROP INDEX IF EXISTS idx_organizations_parent_id;
DROP INDEX IF EXISTS idx_org_garage_accounts_org_garage;
DROP INDEX IF EXISTS idx_org_garage_accounts_org_id;
DROP INDEX IF EXISTS idx_fuel_trans_org_date_totals;
DROP INDEX IF EXISTS idx_fuel_trans_driver_date_totals;
DROP INDEX IF EXISTS idx_fuel_trans_garage_org_date_totals;

-- ============================================================================
-- PART 5: Fix Function Search Paths
-- ============================================================================

-- Fix update_organization_garage_accounts_updated_at
DROP FUNCTION IF EXISTS update_organization_garage_accounts_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION update_organization_garage_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_organization_garage_accounts_updated_at
  BEFORE UPDATE ON organization_garage_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_garage_accounts_updated_at();

-- Fix uppercase_registration_number
DROP FUNCTION IF EXISTS uppercase_registration_number() CASCADE;
CREATE OR REPLACE FUNCTION uppercase_registration_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.registration_number = UPPER(NEW.registration_number);
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER uppercase_vehicle_registration
  BEFORE INSERT OR UPDATE OF registration_number ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION uppercase_registration_number();

-- Fix acquire_transaction_lock
DROP FUNCTION IF EXISTS acquire_transaction_lock(uuid, text) CASCADE;
CREATE OR REPLACE FUNCTION acquire_transaction_lock(
  p_organization_id uuid,
  p_lock_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  lock_key bigint;
BEGIN
  -- Generate a consistent hash for the lock key
  lock_key := ('x' || substr(md5(p_organization_id::text || p_lock_type), 1, 15))::bit(60)::bigint;
  
  -- Try to acquire advisory lock (non-blocking)
  RETURN pg_try_advisory_xact_lock(lock_key);
END;
$$;
