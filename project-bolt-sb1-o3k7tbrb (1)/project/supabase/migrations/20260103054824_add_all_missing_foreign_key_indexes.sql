/*
  # Add All Missing Foreign Key Indexes
  
  This migration adds indexes for all foreign keys that don't have covering indexes.
  These indexes significantly improve JOIN performance and referential integrity checks.
  
  ## Foreign Key Indexes Added
  
  ### Backup and File Management
  - backup_logs.created_by
  - file_snapshots.snapshot_group_id
  - snapshot_groups.created_by
  
  ### Banking and Statements
  - bank_statement_imports.imported_by
  - bank_statement_imports.organization_id
  - bank_statement_transactions.import_id
  - bank_statement_transactions.matched_by
  - bank_statement_transactions.matched_to_payment_id
  - bank_statement_transactions.organization_id
  - banking_day_overrides.created_by
  
  ### Credit Control
  - credit_control_actions.organization_id
  - credit_control_actions.performed_by
  - credit_notes.created_by
  - credit_notes.organization_id
  
  ### Debit Orders
  - debit_order_mandate_documents.replaced_by
  - debit_order_mandate_documents.uploaded_by
  - debit_order_mandates.created_by
  - debit_order_mandates.organization_id
  
  ### Drivers and Sessions
  - driver_payment_settings.organization_id
  - driver_sessions.driver_id
  
  ### EFT Batches
  - eft_batch_items.batch_id
  - eft_batch_items.garage_id
  
  ### Payments
  - failed_payment_attempts.organization_id
  - payment_allocations.allocated_by
  - payment_proof_documents.organization_id
  - payment_proof_documents.payment_id
  - payment_proof_documents.uploaded_by
  - payment_proof_documents.verified_by
  - payments.created_by
  - payments.organization_id
  - payments.verified_by
  
  ### Fuel System
  - fuel_cards.organization_id
  - fuel_transaction_items.fuel_transaction_id
  - fuel_transactions.driver_id
  - fuel_transactions.eft_batch_id
  - fuel_transactions.fuel_card_id
  - fuel_transactions.garage_id
  - fuel_transactions.invoice_id
  - fuel_transactions.nfc_payment_transaction_id
  
  ### Garages and Organizations
  - garages.organization_id
  - organizations.parent_org_id
  - profiles.organization_id
  
  ### Invoices
  - invoice_line_items.fuel_transaction_id
  - invoice_line_items.vehicle_id
  - invoices.created_by
  
  ### NFC Payments
  - nfc_payment_transactions.driver_id
  
  ### Reports
  - custom_report_templates.organization_id
  
  ### Reconciliation
  - reconciliation_matches.bank_transaction_id
  - reconciliation_matches.confirmed_by
  - reconciliation_matches.matched_by
  - reconciliation_matches.organization_id
  - reconciliation_matches.payment_id
  
  ### Public Holidays
  - public_holidays.created_by
  
  ### Vehicles
  - vehicle_exceptions.driver_id
  - vehicle_exceptions.resolved_by
  - vehicle_transactions.organization_id
  - vehicle_transactions.related_transaction_id
  - vehicles.organization_id
*/

-- ============================================================================
-- Backup and File Management Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by 
  ON backup_logs(created_by);

CREATE INDEX IF NOT EXISTS idx_file_snapshots_snapshot_group_id 
  ON file_snapshots(snapshot_group_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_groups_created_by 
  ON snapshot_groups(created_by);

-- ============================================================================
-- Banking and Statement Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_imported_by 
  ON bank_statement_imports(imported_by);

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_organization_id 
  ON bank_statement_imports(organization_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_import_id 
  ON bank_statement_transactions(import_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_matched_by 
  ON bank_statement_transactions(matched_by);

CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_matched_to_payment_id 
  ON bank_statement_transactions(matched_to_payment_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_transactions_organization_id 
  ON bank_statement_transactions(organization_id);

CREATE INDEX IF NOT EXISTS idx_banking_day_overrides_created_by 
  ON banking_day_overrides(created_by);

-- ============================================================================
-- Credit Control Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_credit_control_actions_organization_id 
  ON credit_control_actions(organization_id);

CREATE INDEX IF NOT EXISTS idx_credit_control_actions_performed_by 
  ON credit_control_actions(performed_by);

CREATE INDEX IF NOT EXISTS idx_credit_notes_created_by 
  ON credit_notes(created_by);

CREATE INDEX IF NOT EXISTS idx_credit_notes_organization_id 
  ON credit_notes(organization_id);

-- ============================================================================
-- Debit Order Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_debit_order_mandate_documents_replaced_by 
  ON debit_order_mandate_documents(replaced_by);

CREATE INDEX IF NOT EXISTS idx_debit_order_mandate_documents_uploaded_by 
  ON debit_order_mandate_documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_debit_order_mandates_created_by 
  ON debit_order_mandates(created_by);

CREATE INDEX IF NOT EXISTS idx_debit_order_mandates_organization_id 
  ON debit_order_mandates(organization_id);

-- ============================================================================
-- Driver and Session Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_driver_payment_settings_organization_id 
  ON driver_payment_settings(organization_id);

CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id 
  ON driver_sessions(driver_id);

-- ============================================================================
-- EFT Batch Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_eft_batch_items_batch_id 
  ON eft_batch_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id 
  ON eft_batch_items(garage_id);

-- ============================================================================
-- Payment Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_failed_payment_attempts_organization_id 
  ON failed_payment_attempts(organization_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_allocated_by 
  ON payment_allocations(allocated_by);

CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_organization_id 
  ON payment_proof_documents(organization_id);

CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_payment_id 
  ON payment_proof_documents(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_uploaded_by 
  ON payment_proof_documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_payment_proof_documents_verified_by 
  ON payment_proof_documents(verified_by);

CREATE INDEX IF NOT EXISTS idx_payments_created_by 
  ON payments(created_by);

CREATE INDEX IF NOT EXISTS idx_payments_organization_id 
  ON payments(organization_id);

CREATE INDEX IF NOT EXISTS idx_payments_verified_by 
  ON payments(verified_by);

-- ============================================================================
-- Fuel System Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fuel_cards_organization_id 
  ON fuel_cards(organization_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transaction_items_fuel_transaction_id 
  ON fuel_transaction_items(fuel_transaction_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver_id 
  ON fuel_transactions(driver_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_eft_batch_id 
  ON fuel_transactions(eft_batch_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_fuel_card_id 
  ON fuel_transactions(fuel_card_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_id 
  ON fuel_transactions(garage_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_invoice_id 
  ON fuel_transactions(invoice_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_nfc_payment_transaction_id 
  ON fuel_transactions(nfc_payment_transaction_id);

-- ============================================================================
-- Garage and Organization Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_garages_organization_id 
  ON garages(organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id 
  ON organizations(parent_org_id);

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id 
  ON profiles(organization_id);

-- ============================================================================
-- Invoice Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_fuel_transaction_id 
  ON invoice_line_items(fuel_transaction_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_vehicle_id 
  ON invoice_line_items(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_invoices_created_by 
  ON invoices(created_by);

-- ============================================================================
-- NFC Payment Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_nfc_payment_transactions_driver_id 
  ON nfc_payment_transactions(driver_id);

-- ============================================================================
-- Report Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_custom_report_templates_organization_id 
  ON custom_report_templates(organization_id);

-- ============================================================================
-- Reconciliation Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_bank_transaction_id 
  ON reconciliation_matches(bank_transaction_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_confirmed_by 
  ON reconciliation_matches(confirmed_by);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_matched_by 
  ON reconciliation_matches(matched_by);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_organization_id 
  ON reconciliation_matches(organization_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_payment_id 
  ON reconciliation_matches(payment_id);

-- ============================================================================
-- Public Holiday Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_public_holidays_created_by 
  ON public_holidays(created_by);

-- ============================================================================
-- Vehicle Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_driver_id 
  ON vehicle_exceptions(driver_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_resolved_by 
  ON vehicle_exceptions(resolved_by);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_organization_id 
  ON vehicle_transactions(organization_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_related_transaction_id 
  ON vehicle_transactions(related_transaction_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id 
  ON vehicles(organization_id);

-- ============================================================================
-- NOTES
-- ============================================================================

-- All foreign keys now have covering indexes for optimal query performance.
-- These indexes will improve:
-- 1. JOIN operations between tables
-- 2. Foreign key constraint checks
-- 3. Query performance when filtering by foreign key columns
-- 4. Cascade delete/update operations
