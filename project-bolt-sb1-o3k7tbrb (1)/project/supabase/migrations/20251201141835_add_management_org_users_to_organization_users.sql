/*
  # Add Management Organization Users to organization_users Table

  1. Changes
    - Insert management organization users into organization_users table
    - Ensure super_admin and management org users have proper permissions
    - Grant full permissions to management organization users
    
  2. Details
    - Finds all users with organization_id pointing to management org
    - Creates organization_user entries with full permissions
    - Sets is_main_user = true for super_admin role users
    - Ensures existing users in organization_users are not duplicated
*/

-- Insert management organization users into organization_users table
INSERT INTO organization_users (
  organization_id,
  user_id,
  email,
  name,
  surname,
  is_main_user,
  can_add_vehicles,
  can_edit_vehicles,
  can_delete_vehicles,
  can_add_drivers,
  can_edit_drivers,
  can_delete_drivers,
  can_view_reports,
  can_edit_organization_info,
  can_view_fuel_transactions,
  can_create_reports,
  can_view_custom_reports,
  can_manage_users,
  can_view_financial_data,
  is_active
)
SELECT 
  p.organization_id,
  p.id as user_id,
  p.email,
  COALESCE(SPLIT_PART(p.full_name, ' ', 1), 'Admin') as name,
  COALESCE(NULLIF(SUBSTRING(p.full_name FROM POSITION(' ' IN p.full_name) + 1), ''), 'User') as surname,
  (p.role = 'super_admin') as is_main_user,
  true as can_add_vehicles,
  true as can_edit_vehicles,
  true as can_delete_vehicles,
  true as can_add_drivers,
  true as can_edit_drivers,
  true as can_delete_drivers,
  true as can_view_reports,
  true as can_edit_organization_info,
  true as can_view_fuel_transactions,
  true as can_create_reports,
  true as can_view_custom_reports,
  true as can_manage_users,
  true as can_view_financial_data,
  true as is_active
FROM profiles p
WHERE p.organization_id IN (
  SELECT id FROM organizations 
  WHERE name = 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD'
)
AND NOT EXISTS (
  SELECT 1 FROM organization_users ou 
  WHERE ou.user_id = p.id 
  AND ou.organization_id = p.organization_id
);
