/*
  # Add Foreign Key Indexes and Fix Security Definer Views

  ## Changes

  ### 1. Add Foreign Key Indexes
  - Add indexes for all foreign keys to improve query performance
  - Foreign keys without indexes can cause slow JOIN operations and CASCADE operations

  ### 2. Fix Security Definer Views
  - Drop and recreate views without SECURITY DEFINER
  - Use proper syntax to ensure views use caller's permissions

  ## Performance Impact
  - Indexes will improve JOIN performance significantly
  - Small storage overhead for indexes

  ## Security Impact
  - Views will use caller's RLS policies instead of bypassing them
  - More secure and transparent access control
*/

-- =====================================================
-- 1. ADD FOREIGN KEY INDEXES
-- =====================================================

-- Index for backup_logs.created_by
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by 
  ON backup_logs(created_by);

-- Index for custom_report_templates.user_id
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_user_id 
  ON custom_report_templates(user_id);

-- Index for driver_sessions.driver_id
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id 
  ON driver_sessions(driver_id);

-- Index for drivers.deleted_by
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_by 
  ON drivers(deleted_by);

-- Index for drivers.user_id
CREATE INDEX IF NOT EXISTS idx_drivers_user_id 
  ON drivers(user_id);

-- Index for eft_batch_items.garage_id
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id 
  ON eft_batch_items(garage_id);

-- Index for fuel_cards.assigned_to_user_id
CREATE INDEX IF NOT EXISTS idx_fuel_cards_assigned_to_user_id 
  ON fuel_cards(assigned_to_user_id);

-- Index for fuel_cards.assigned_to_vehicle_id
CREATE INDEX IF NOT EXISTS idx_fuel_cards_assigned_to_vehicle_id 
  ON fuel_cards(assigned_to_vehicle_id);

-- Index for fuel_transactions.driver_id
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver_id 
  ON fuel_transactions(driver_id);

-- Index for fuel_transactions.fuel_card_id
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_fuel_card_id 
  ON fuel_transactions(fuel_card_id);

-- Index for fuel_transactions.garage_id
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_id 
  ON fuel_transactions(garage_id);

-- Index for garages.organization_id
CREATE INDEX IF NOT EXISTS idx_garages_organization_id 
  ON garages(organization_id);

-- Index for organization_users.user_id
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id 
  ON organization_users(user_id);

-- Index for organizations.parent_org_id
CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id 
  ON organizations(parent_org_id);

-- Index for profiles.organization_id
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id 
  ON profiles(organization_id);

-- Index for spending_alerts.fuel_card_id
CREATE INDEX IF NOT EXISTS idx_spending_alerts_fuel_card_id 
  ON spending_alerts(fuel_card_id);

-- Index for vehicle_transactions.driver_id
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_driver_id 
  ON vehicle_transactions(driver_id);

-- Index for vehicle_transactions.organization_id
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_organization_id 
  ON vehicle_transactions(organization_id);

-- Index for vehicle_transactions.related_transaction_id
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_related_transaction_id 
  ON vehicle_transactions(related_transaction_id);

-- Index for vehicle_transactions.vehicle_id
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_vehicle_id 
  ON vehicle_transactions(vehicle_id);

-- Index for vehicles.deleted_by
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_by 
  ON vehicles(deleted_by);

-- =====================================================
-- 2. FIX SECURITY DEFINER VIEWS (AGAIN)
-- =====================================================

-- Drop existing views completely
DROP VIEW IF EXISTS garage_daily_sales CASCADE;
DROP VIEW IF EXISTS vehicle_statistics CASCADE;
DROP VIEW IF EXISTS driver_statistics CASCADE;

-- Recreate garage_daily_sales as regular view (not SECURITY DEFINER)
CREATE VIEW garage_daily_sales 
WITH (security_invoker = true)
AS
SELECT 
  ft.garage_id,
  g.name as garage_name,
  g.email_address as garage_email,
  DATE(ft.transaction_date) as sale_date,
  ft.id as transaction_id,
  ft.organization_id,
  o.name as organization_name,
  ft.vehicle_id,
  v.license_plate,
  v.make,
  v.model,
  ft.driver_id,
  ft.fuel_type,
  ft.liters,
  ft.price_per_liter,
  ft.total_amount as rand_value,
  ft.commission_rate,
  ft.commission_amount,
  ft.net_amount,
  ft.odometer_reading
FROM fuel_transactions ft
JOIN garages g ON ft.garage_id = g.id
JOIN organizations o ON ft.organization_id = o.id
JOIN vehicles v ON ft.vehicle_id = v.id
WHERE ft.garage_id IS NOT NULL;

-- Recreate vehicle_statistics as regular view (not SECURITY DEFINER)
CREATE VIEW vehicle_statistics
WITH (security_invoker = true)
AS
SELECT 
  v.id as vehicle_id,
  v.organization_id,
  v.license_plate,
  v.make,
  v.model,
  v.initial_odometer_reading,
  COUNT(ft.id) as total_transactions,
  COALESCE(SUM(ft.liters), 0) as total_liters,
  COALESCE(SUM(ft.total_amount), 0) as total_spent,
  MAX(ft.odometer_reading) as latest_odometer,
  COALESCE(MAX(ft.odometer_reading) - v.initial_odometer_reading, 0) as total_km_travelled,
  CASE 
    WHEN (MAX(ft.odometer_reading) - v.initial_odometer_reading) > 0 
    THEN (SUM(ft.liters) * 100.0) / (MAX(ft.odometer_reading) - v.initial_odometer_reading)
    ELSE 0
  END as actual_consumption_per_100km,
  v.average_fuel_consumption_per_100km as expected_consumption_per_100km,
  CASE 
    WHEN v.average_fuel_consumption_per_100km > 0 AND (MAX(ft.odometer_reading) - v.initial_odometer_reading) > 0
    THEN ((SUM(ft.liters) * 100.0) / (MAX(ft.odometer_reading) - v.initial_odometer_reading) - v.average_fuel_consumption_per_100km) / v.average_fuel_consumption_per_100km * 100
    ELSE 0
  END as consumption_variance_percentage
FROM vehicles v
LEFT JOIN fuel_transactions ft ON v.id = ft.vehicle_id
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.organization_id, v.license_plate, v.make, v.model, 
         v.initial_odometer_reading, v.average_fuel_consumption_per_100km;

-- Recreate driver_statistics as regular view (not SECURITY DEFINER)
CREATE VIEW driver_statistics
WITH (security_invoker = true)
AS
SELECT 
  d.id as driver_id,
  d.organization_id,
  d.first_name,
  d.last_name,
  d.id_number,
  COUNT(ft.id) as total_transactions,
  COUNT(DISTINCT ft.vehicle_id) as vehicles_driven,
  COALESCE(SUM(ft.liters), 0) as total_liters,
  COALESCE(SUM(ft.total_amount), 0) as total_spent,
  CASE 
    WHEN COUNT(ft.id) > 0 
    THEN SUM(ft.total_amount) / COUNT(ft.id)
    ELSE 0
  END as average_transaction_amount,
  MAX(ft.transaction_date) as last_transaction_date,
  MIN(ft.transaction_date) as first_transaction_date
FROM drivers d
LEFT JOIN fuel_transactions ft ON d.id = ft.driver_id
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.organization_id, d.first_name, d.last_name, d.id_number;

-- Grant access to views
GRANT SELECT ON garage_daily_sales TO authenticated, anon;
GRANT SELECT ON vehicle_statistics TO authenticated, anon;
GRANT SELECT ON driver_statistics TO authenticated, anon;

-- Add comments to views to document security model
COMMENT ON VIEW garage_daily_sales IS 'View of daily garage sales. Uses security_invoker to respect RLS policies.';
COMMENT ON VIEW vehicle_statistics IS 'Vehicle fuel consumption statistics. Uses security_invoker to respect RLS policies.';
COMMENT ON VIEW driver_statistics IS 'Driver transaction statistics. Uses security_invoker to respect RLS policies.';
