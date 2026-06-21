/*
  # Add Comprehensive User Permissions

  1. Changes to organization_users table
    - Add permissions for organization information management
    - Add permissions for fuel transaction management
    - Add permissions for report management
    - Add permissions for user management
    
  2. New Permission Fields
    - `can_edit_organization_info` - Can edit organization details, bank info, addresses
    - `can_view_fuel_transactions` - Can view fuel transactions
    - `can_add_fuel_transactions` - Can add new fuel transactions
    - `can_edit_fuel_transactions` - Can edit fuel transactions
    - `can_delete_fuel_transactions` - Can delete fuel transactions
    - `can_create_reports` - Can create and save custom reports
    - `can_view_custom_reports` - Can view saved custom reports
    - `can_manage_users` - Can add, edit, and delete other users
    - `can_view_financial_data` - Can view commission rates and financial details
    
  3. Notes
    - Main users automatically get all permissions
    - Regular users need permissions assigned explicitly
    - Super admins bypass all permission checks
*/

-- Add new permission columns to organization_users table
DO $$
BEGIN
  -- Organization management permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_edit_organization_info'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_organization_info boolean DEFAULT false;
  END IF;

  -- Fuel transaction permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_view_fuel_transactions'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_view_fuel_transactions boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_add_fuel_transactions'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_add_fuel_transactions boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_edit_fuel_transactions'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_fuel_transactions boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_delete_fuel_transactions'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_delete_fuel_transactions boolean DEFAULT false;
  END IF;

  -- Report permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_create_reports'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_create_reports boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_view_custom_reports'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_view_custom_reports boolean DEFAULT true;
  END IF;

  -- User management permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_manage_users'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_manage_users boolean DEFAULT false;
  END IF;

  -- Financial data permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'can_view_financial_data'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_view_financial_data boolean DEFAULT false;
  END IF;
END $$;

-- Update existing main users to have all permissions
UPDATE organization_users
SET 
  can_edit_organization_info = true,
  can_view_fuel_transactions = true,
  can_add_fuel_transactions = true,
  can_edit_fuel_transactions = true,
  can_delete_fuel_transactions = true,
  can_create_reports = true,
  can_view_custom_reports = true,
  can_manage_users = true,
  can_view_financial_data = true
WHERE is_main_user = true;