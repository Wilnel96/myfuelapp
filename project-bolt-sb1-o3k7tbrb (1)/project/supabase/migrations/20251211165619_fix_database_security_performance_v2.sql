/*
  # Fix Database Security and Performance Issues (Part 1)
  
  This migration addresses:
  1. Add Missing Indexes on Foreign Keys (11 indexes)
  2. Remove Unused Indexes (20 indexes)
  3. Remove Duplicate Indexes
  
  Performance impact: Significant improvement in query performance
*/

-- =====================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by 
  ON backup_logs(created_by);

CREATE INDEX IF NOT EXISTS idx_drivers_deleted_by 
  ON drivers(deleted_by);

CREATE INDEX IF NOT EXISTS idx_fuel_cards_assigned_to_user_id 
  ON fuel_cards(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_fuel_cards_assigned_to_vehicle_id 
  ON fuel_cards(assigned_to_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver_id 
  ON fuel_transactions(driver_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_fuel_card_id 
  ON fuel_transactions(fuel_card_id);

CREATE INDEX IF NOT EXISTS idx_garages_organization_id 
  ON garages(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_users_user_id 
  ON organization_users(user_id);

CREATE INDEX IF NOT EXISTS idx_spending_alerts_fuel_card_id 
  ON spending_alerts(fuel_card_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_related_transaction_id 
  ON vehicle_transactions(related_transaction_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_by 
  ON vehicles(deleted_by);

-- =====================================================
-- PART 2: REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_profiles_organization;
DROP INDEX IF EXISTS profiles_role_idx;
DROP INDEX IF EXISTS idx_vehicles_deleted_at;
DROP INDEX IF EXISTS idx_eft_batch_items_garage_id;
DROP INDEX IF EXISTS driver_sessions_driver_id_idx;
DROP INDEX IF EXISTS driver_sessions_token_idx;
DROP INDEX IF EXISTS driver_sessions_expires_at_idx;
DROP INDEX IF EXISTS idx_fuel_transactions_date;
DROP INDEX IF EXISTS idx_organization_users_is_active;
DROP INDEX IF EXISTS organizations_status_idx;
DROP INDEX IF EXISTS organizations_is_management_org_idx;
DROP INDEX IF EXISTS organizations_parent_org_id_idx;
DROP INDEX IF EXISTS drivers_user_id_idx;
DROP INDEX IF EXISTS drivers_license_number_idx;
DROP INDEX IF EXISTS idx_drivers_deleted_at;
DROP INDEX IF EXISTS idx_custom_report_templates_user_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_vehicle_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_driver_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_organization_id;
DROP INDEX IF EXISTS idx_vehicle_transactions_created_at;

-- =====================================================
-- PART 3: REMOVE DUPLICATE INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_fuel_transactions_date;
