/*
  # Add Missing Foreign Key Indexes

  ## Overview
  This migration adds indexes for all foreign key columns that currently lack covering indexes.
  Foreign key columns without indexes can cause significant performance degradation during:
  - JOIN operations
  - Foreign key constraint checks on DELETE/UPDATE
  - Query planning and optimization

  ## Performance Impact
  Adding these indexes will:
  - Significantly improve query performance for joins
  - Speed up DELETE operations on referenced tables
  - Reduce lock contention during high-concurrency operations
  - Improve query planner efficiency

  ## Indexes Added
  This migration adds 27 indexes for unindexed foreign key columns across multiple tables.

  ## Notes
  - Indexes are created with IF NOT EXISTS to prevent errors if they already exist
  - Index names follow the pattern: idx_<table>_<column>
  - These are standard B-tree indexes suitable for foreign key lookups
*/

-- custom_report_templates table
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_organization_id 
ON custom_report_templates(organization_id);

-- driver_payment_settings table
CREATE INDEX IF NOT EXISTS idx_driver_payment_settings_organization_id 
ON driver_payment_settings(organization_id);

-- eft_batch_items table
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_batch_id 
ON eft_batch_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id 
ON eft_batch_items(garage_id);

-- fuel_cards table
CREATE INDEX IF NOT EXISTS idx_fuel_cards_organization_id 
ON fuel_cards(organization_id);

-- fuel_transaction_items table
CREATE INDEX IF NOT EXISTS idx_fuel_transaction_items_fuel_transaction_id 
ON fuel_transaction_items(fuel_transaction_id);

-- fuel_transactions table (multiple foreign keys)
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

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_organization_id 
ON fuel_transactions(organization_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_id 
ON fuel_transactions(vehicle_id);

-- garages table
CREATE INDEX IF NOT EXISTS idx_garages_organization_id 
ON garages(organization_id);

-- invoice_line_items table
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_fuel_transaction_id 
ON invoice_line_items(fuel_transaction_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_vehicle_id 
ON invoice_line_items(vehicle_id);

-- nfc_payment_transactions table
CREATE INDEX IF NOT EXISTS idx_nfc_payment_transactions_driver_id 
ON nfc_payment_transactions(driver_id);

CREATE INDEX IF NOT EXISTS idx_nfc_payment_transactions_organization_card_id 
ON nfc_payment_transactions(organization_card_id);

-- organization_payment_cards table
CREATE INDEX IF NOT EXISTS idx_organization_payment_cards_encryption_key_id 
ON organization_payment_cards(encryption_key_id);

-- organizations table
CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id 
ON organizations(parent_org_id);

-- profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id 
ON profiles(organization_id);

-- vehicle_exceptions table
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_driver_id 
ON vehicle_exceptions(driver_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_organization_id 
ON vehicle_exceptions(organization_id);

-- vehicle_transactions table
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_organization_id 
ON vehicle_transactions(organization_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_related_transaction_id 
ON vehicle_transactions(related_transaction_id);

-- vehicles table
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id 
ON vehicles(organization_id);

-- Add comments to document the purpose of these indexes
COMMENT ON INDEX idx_fuel_transactions_organization_id IS 'Foreign key index for improved join and delete performance';
COMMENT ON INDEX idx_fuel_transactions_vehicle_id IS 'Foreign key index for improved join and delete performance';
COMMENT ON INDEX idx_fuel_transactions_driver_id IS 'Foreign key index for improved join and delete performance';
COMMENT ON INDEX idx_fuel_transactions_garage_id IS 'Foreign key index for improved join and delete performance';
