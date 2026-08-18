-- Backup schema: full snapshot of all data tables before dormant org cleanup
-- Created: 2026-08-18
-- This creates a backup_schema_20260818 schema with copies of all data tables
-- To restore: INSERT INTO public.<table> SELECT * FROM backup_schema_20260818.<table>;

CREATE SCHEMA IF NOT EXISTS backup_schema_20260818;

-- Core tables
CREATE TABLE backup_schema_20260818.organizations AS SELECT * FROM public.organizations;
CREATE TABLE backup_schema_20260818.organization_users AS SELECT * FROM public.organization_users;
CREATE TABLE backup_schema_20260818.profiles AS SELECT * FROM public.profiles;
CREATE TABLE backup_schema_20260818.organization_payment_cards AS SELECT * FROM public.organization_payment_cards;
CREATE TABLE backup_schema_20260818.organization_garage_accounts AS SELECT * FROM public.organization_garage_accounts;

-- Vehicle/Driver tables
CREATE TABLE backup_schema_20260818.vehicles AS SELECT * FROM public.vehicles;
CREATE TABLE backup_schema_20260818.drivers AS SELECT * FROM public.drivers;
CREATE TABLE backup_schema_20260818.trailers AS SELECT * FROM public.trailers;
CREATE TABLE backup_schema_20260818.driver_payment_settings AS SELECT * FROM public.driver_payment_settings;
CREATE TABLE backup_schema_20260818.driver_sessions AS SELECT * FROM public.driver_sessions;
CREATE TABLE backup_schema_20260818.driver_spending_tracking AS SELECT * FROM public.driver_spending_tracking;

-- Transaction tables
CREATE TABLE backup_schema_20260818.fuel_transactions AS SELECT * FROM public.fuel_transactions;
CREATE TABLE backup_schema_20260818.fuel_transaction_invoices AS SELECT * FROM public.fuel_transaction_invoices;
CREATE TABLE backup_schema_20260818.fuel_transaction_items AS SELECT * FROM public.fuel_transaction_items;
CREATE TABLE backup_schema_20260818.vehicle_transactions AS SELECT * FROM public.vehicle_transactions;
CREATE TABLE backup_schema_20260818.vehicle_exceptions AS SELECT * FROM public.vehicle_exceptions;
CREATE TABLE backup_schema_20260818.vehicle_maintenance_records AS SELECT * FROM public.vehicle_maintenance_records;
CREATE TABLE backup_schema_20260818.nfc_payment_transactions AS SELECT * FROM public.nfc_payment_transactions;

-- Invoice/Payment tables
CREATE TABLE backup_schema_20260818.invoices AS SELECT * FROM public.invoices;
CREATE TABLE backup_schema_20260818.invoice_line_items AS SELECT * FROM public.invoice_line_items;
CREATE TABLE backup_schema_20260818.invoice_sequence AS SELECT * FROM public.invoice_sequence;
CREATE TABLE backup_schema_20260818.payments AS SELECT * FROM public.payments;
CREATE TABLE backup_schema_20260818.payment_allocations AS SELECT * FROM public.payment_allocations;
CREATE TABLE backup_schema_20260818.credit_notes AS SELECT * FROM public.credit_notes;
CREATE TABLE backup_schema_20260818.credit_note_line_items AS SELECT * FROM public.credit_note_line_items;
CREATE TABLE backup_schema_20260818.credit_note_sequence AS SELECT * FROM public.credit_note_sequence;

-- Garage tables
CREATE TABLE backup_schema_20260818.garages AS SELECT * FROM public.garages;
CREATE TABLE backup_schema_20260818.garage_debtor_payments AS SELECT * FROM public.garage_debtor_payments;
CREATE TABLE backup_schema_20260818.garage_fee_invoices AS SELECT * FROM public.garage_fee_invoices;
CREATE TABLE backup_schema_20260818.garage_fee_invoice_line_items AS SELECT * FROM public.garage_fee_invoice_line_items;
CREATE TABLE backup_schema_20260818.garage_statements AS SELECT * FROM public.garage_statements;
CREATE TABLE backup_schema_20260818.client_statements AS SELECT * FROM public.client_statements;
CREATE TABLE backup_schema_20260818.statement_sequence AS SELECT * FROM public.statement_sequence;

-- Debit order tables
CREATE TABLE backup_schema_20260818.debit_order_runs AS SELECT * FROM public.debit_order_runs;
CREATE TABLE backup_schema_20260818.debit_order_run_items AS SELECT * FROM public.debit_order_run_items;
CREATE TABLE backup_schema_20260818.debit_order_mandates AS SELECT * FROM public.debit_order_mandates;
CREATE TABLE backup_schema_20260818.debit_order_mandate_documents AS SELECT * FROM public.debit_order_mandate_documents;

-- Other tables
CREATE TABLE backup_schema_20260818.custom_report_templates AS SELECT * FROM public.custom_report_templates;
CREATE TABLE backup_schema_20260818.global_settings AS SELECT * FROM public.global_settings;
CREATE TABLE backup_schema_20260818.price_zone_references AS SELECT * FROM public.price_zone_references;
CREATE TABLE backup_schema_20260818.fuel_cards AS SELECT * FROM public.fuel_cards;
CREATE TABLE backup_schema_20260818.encryption_keys AS SELECT * FROM public.encryption_keys;
CREATE TABLE backup_schema_20260818.failed_payment_attempts AS SELECT * FROM public.failed_payment_attempts;
CREATE TABLE backup_schema_20260818.credit_control_actions AS SELECT * FROM public.credit_control_actions;
CREATE TABLE backup_schema_20260818.payment_proof_documents AS SELECT * FROM public.payment_proof_documents;
CREATE TABLE backup_schema_20260818.bank_statement_imports AS SELECT * FROM public.bank_statement_imports;
CREATE TABLE backup_schema_20260818.bank_statement_transactions AS SELECT * FROM public.bank_statement_transactions;
CREATE TABLE backup_schema_20260818.reconciliation_matches AS SELECT * FROM public.reconciliation_matches;
CREATE TABLE backup_schema_20260818.public_holidays AS SELECT * FROM public.public_holidays;
CREATE TABLE backup_schema_20260818.banking_day_overrides AS SELECT * FROM public.banking_day_overrides;
CREATE TABLE backup_schema_20260818.system_documentation AS SELECT * FROM public.system_documentation;
CREATE TABLE backup_schema_20260818.backup_logs AS SELECT * FROM public.backup_logs;
CREATE TABLE backup_schema_20260818.file_snapshots AS SELECT * FROM public.file_snapshots;
CREATE TABLE backup_schema_20260818.snapshot_groups AS SELECT * FROM public.snapshot_groups;
