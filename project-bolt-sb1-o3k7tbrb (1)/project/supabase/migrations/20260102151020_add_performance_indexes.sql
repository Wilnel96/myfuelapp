/*
  # Performance Optimization - Add Composite Indexes

  1. Purpose
    - Add composite indexes for frequently queried columns
    - Optimize RLS policy execution
    - Improve JOIN performance
    - Speed up filtering and sorting operations

  2. Indexes Added
    - vehicles: organization_id + status, organization_id + registration_number
    - drivers: organization_id + status, organization_id + id_number
    - fuel_transactions: organization_id + transaction_date, vehicle_id + transaction_date
    - vehicle_transactions: organization_id + created_at, driver_id + transaction_type
    - organization_users: organization_id + is_active, user_id + organization_id
    - garages: city, price_zone, fuel_brand
    - fuel_transaction_invoices: organization_id + invoice_date
    - organizations: parent_org_id
    - vehicle_exceptions: vehicle_id + created_at, organization_id + created_at
    - organization_garage_accounts: organization_id + garage_id

  3. Performance Impact
    - Reduces query time for filtered vehicle/driver lists
    - Speeds up RLS policy checks
    - Improves dashboard load times
    - Optimizes report generation
*/

-- Vehicles table indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_org_status
  ON vehicles(organization_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_vehicles_org_reg_number
  ON vehicles(organization_id, registration_number);

CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type
  ON vehicles(fuel_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_vehicles_last_service
  ON vehicles(last_service_date)
  WHERE last_service_date IS NOT NULL AND status = 'active';

-- Drivers table indexes
CREATE INDEX IF NOT EXISTS idx_drivers_org_status
  ON drivers(organization_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_drivers_org_id_number
  ON drivers(organization_id, id_number);

CREATE INDEX IF NOT EXISTS idx_drivers_license_expiry
  ON drivers(license_expiry_date)
  WHERE license_expiry_date IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_drivers_prdp_expiry
  ON drivers(prdp_expiry_date)
  WHERE prdp_expiry_date IS NOT NULL AND status = 'active';

-- Fuel transactions indexes
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_org_date
  ON fuel_transactions(organization_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_date
  ON fuel_transactions(vehicle_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver_date
  ON fuel_transactions(driver_id, transaction_date DESC)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_date
  ON fuel_transactions(garage_id, transaction_date DESC);

-- Vehicle transactions indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_org_date
  ON vehicle_transactions(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_driver_type
  ON vehicle_transactions(driver_id, transaction_type);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_vehicle_type
  ON vehicle_transactions(vehicle_id, transaction_type);

-- Organization users indexes
CREATE INDEX IF NOT EXISTS idx_org_users_org_active
  ON organization_users(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_org_users_user_org
  ON organization_users(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_org_users_role
  ON organization_users(role, organization_id)
  WHERE is_active = true;

-- Garages indexes
CREATE INDEX IF NOT EXISTS idx_garages_city
  ON garages(city);

CREATE INDEX IF NOT EXISTS idx_garages_price_zone
  ON garages(price_zone);

CREATE INDEX IF NOT EXISTS idx_garages_fuel_brand
  ON garages(fuel_brand);

-- Fuel transaction invoices indexes
CREATE INDEX IF NOT EXISTS idx_fuel_invoices_org_date
  ON fuel_transaction_invoices(organization_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_invoices_transaction
  ON fuel_transaction_invoices(fuel_transaction_id);

CREATE INDEX IF NOT EXISTS idx_fuel_invoices_number
  ON fuel_transaction_invoices(invoice_number);

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id
  ON organizations(parent_org_id)
  WHERE parent_org_id IS NOT NULL;

-- Vehicle exceptions indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_vehicle
  ON vehicle_exceptions(vehicle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_org
  ON vehicle_exceptions(organization_id, created_at DESC);

-- Organization garage accounts indexes
CREATE INDEX IF NOT EXISTS idx_org_garage_accounts_org_garage
  ON organization_garage_accounts(organization_id, garage_id);

CREATE INDEX IF NOT EXISTS idx_org_garage_accounts_active
  ON organization_garage_accounts(garage_id, is_active)
  WHERE is_active = true;

-- Add VACUUM ANALYZE to update statistics
ANALYZE vehicles;
ANALYZE drivers;
ANALYZE fuel_transactions;
ANALYZE vehicle_transactions;
ANALYZE organization_users;
ANALYZE garages;
ANALYZE fuel_transaction_invoices;
ANALYZE organizations;