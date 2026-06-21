/*
  # Add Missing Permission Columns to Organization Users

  1. Changes
    - Adds can_edit_organization_info column
    - Adds can_view_fuel_transactions column
    - Adds can_create_reports column
    - Adds can_view_custom_reports column
    - Adds can_view_financial_data column (alias for can_view_financial_info)

  2. Security
    - All new columns default to false for security
    - RLS policies will automatically apply to these columns
*/

-- Add missing permission columns
ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS can_edit_organization_info boolean DEFAULT false;

ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS can_view_fuel_transactions boolean DEFAULT false;

ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS can_create_reports boolean DEFAULT false;

ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS can_view_custom_reports boolean DEFAULT false;

ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS can_view_financial_data boolean DEFAULT false;

-- Backfill main users and secondary main users with these new permissions
UPDATE organization_users
SET
  can_edit_organization_info = true,
  can_view_fuel_transactions = true,
  can_create_reports = true,
  can_view_custom_reports = true,
  can_view_financial_data = true
WHERE role IN ('main_user', 'secondary_main_user');
