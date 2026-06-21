/*
  # Clear Separation: Management vs Client Organization Roles

  ## Overview
  This migration establishes a clear distinction between:
  1. Management Organization (Fuel Empowerment Systems) users
  2. Client Organization users
  3. Drivers

  ## Role Structure

  ### Management Organization (is_management_org = true)
  - Uses `profiles.role` with values: 'super_admin', 'admin', 'manager', 'user'
  - NO 'driver' role in management org
  - These users manage the overall system
  - If management org wants to use the system (vehicles/drivers), they must also be loaded as a Client Organization

  ### Client Organizations (is_management_org = false or null)
  - Main account holder has `profiles.role = 'admin'` (for system access)
  - Additional users use `organization_users` table with granular permissions
  - User classification via `organization_users.user_type` field (replaces ambiguous 'title')
  - Drivers are in separate `drivers` table, access only via Driver Mobile App
  - A driver can ALSO be loaded as an organization_user for client portal access

  ## Changes
  1. Update profiles.role CHECK constraint to only allow management roles (no 'billing' or 'driver')
  2. Add user_type field to organization_users for client user classification
  3. Add validation to ensure driver role not used in management org profiles
  4. Keep driver role separate in drivers table

  ## User Types for Client Organizations
  - 'main_user' - Primary account holder (set via role field)
  - 'secondary_main_user' - Secondary main user (set via role field)  
  - 'billing_user' - Handles billing and invoices
  - 'fleet_user' - Manages vehicles
  - 'driver_user' - Manages drivers
  - 'vehicle_user' - Can view/manage vehicles
  - 'standard_user' - Standard access
  - Custom types can be added as needed

  ## Security
  - Maintains all existing RLS policies
  - Ensures proper separation between management and client roles
*/

-- Add user_type field to organization_users for client user classification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_users' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE organization_users 
    ADD COLUMN user_type text DEFAULT 'standard_user' 
    CHECK (user_type IN (
      'main_user',
      'secondary_main_user', 
      'billing_user',
      'fleet_user',
      'driver_user', 
      'vehicle_user',
      'finance_user',
      'reports_user',
      'standard_user'
    ));
  END IF;
END $$;

-- Update existing organization_users to set user_type based on current role and title
UPDATE organization_users 
SET user_type = CASE
  WHEN role = 'main_user' THEN 'main_user'
  WHEN role = 'secondary_main_user' THEN 'secondary_main_user'
  WHEN LOWER(title) LIKE '%billing%' THEN 'billing_user'
  WHEN LOWER(title) LIKE '%fleet%' THEN 'fleet_user'
  WHEN LOWER(title) LIKE '%vehicle%' THEN 'vehicle_user'
  WHEN LOWER(title) LIKE '%driver%' AND LOWER(title) NOT LIKE '%driver manager%' THEN 'driver_user'
  WHEN LOWER(title) LIKE '%finance%' THEN 'finance_user'
  WHEN LOWER(title) LIKE '%report%' THEN 'reports_user'
  ELSE 'standard_user'
END
WHERE user_type IS NULL OR user_type = 'standard_user';

-- Update the profiles.role CHECK constraint to clearly define management roles only
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'manager', 'user'));

-- Add comment to profiles table explaining role usage
COMMENT ON COLUMN profiles.role IS 
'Role for management organization users only. Values: super_admin, admin, manager, user. 
Client organization users should use organization_users.user_type instead.';

-- Add comment to organization_users table
COMMENT ON COLUMN organization_users.user_type IS 
'Classification of client organization users: main_user, secondary_main_user, billing_user, 
fleet_user, driver_user, vehicle_user, finance_user, reports_user, standard_user';

COMMENT ON COLUMN organization_users.role IS 
'Legacy field for main_user/secondary_main_user distinction. Use user_type for classification.';

-- Create index on user_type for faster queries
CREATE INDEX IF NOT EXISTS idx_organization_users_user_type ON organization_users(user_type);

-- Add validation function to prevent driver role in management org profiles
CREATE OR REPLACE FUNCTION validate_management_org_no_driver_role()
RETURNS TRIGGER AS $$
DECLARE
  is_mgmt_org boolean;
BEGIN
  -- Check if this profile belongs to a management organization
  SELECT is_management_org INTO is_mgmt_org
  FROM organizations
  WHERE id = NEW.organization_id;

  -- If it's a management org and role is 'driver', reject it
  IF is_mgmt_org = true AND NEW.role = 'driver' THEN
    RAISE EXCEPTION 'Management organization users cannot have driver role. Drivers must be in the drivers table.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate management org roles
DROP TRIGGER IF EXISTS validate_management_profile_role ON profiles;
CREATE TRIGGER validate_management_profile_role
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_management_org_no_driver_role();

-- Update the backfill migration logic to use proper role mapping
-- (This corrects the earlier migration that tried to use 'billing' role)
UPDATE profiles 
SET role = 'user'
WHERE role NOT IN ('super_admin', 'admin', 'manager', 'user')
AND organization_id IS NOT NULL;

-- Function to check if user is in management organization
CREATE OR REPLACE FUNCTION is_management_org_user(user_id uuid)
RETURNS boolean AS $$
  SELECT COALESCE(
    (
      SELECT o.is_management_org 
      FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = user_id
      LIMIT 1
    ),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_management_org_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_management_org_user(uuid) TO anon;