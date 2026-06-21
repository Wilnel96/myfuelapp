/*
  # Grant All Permissions to Secondary Main Users

  1. Changes
    - Updates the `toggle_secondary_main_user` function to automatically grant all permissions when a user becomes a secondary main user
    - When is_secondary_main_user is set to true, all permission flags are set to true
    - When is_secondary_main_user is set to false, permissions remain unchanged (they can be manually adjusted)
    - Also updates the title to "Secondary User" when becoming a secondary main user
  
  2. Permissions Granted
    - can_add_vehicles
    - can_edit_vehicles
    - can_delete_vehicles
    - can_add_drivers
    - can_edit_drivers
    - can_delete_drivers
    - can_view_reports
    - can_edit_organization_info
    - can_view_fuel_transactions
    - can_create_reports
    - can_view_custom_reports
    - can_manage_users
    - can_view_financial_data
*/

CREATE OR REPLACE FUNCTION toggle_secondary_main_user(user_id_to_toggle uuid)
RETURNS void AS $$
DECLARE
  current_status boolean;
  org_id uuid;
BEGIN
  -- Get current status and organization_id
  SELECT is_secondary_main_user, organization_id 
  INTO current_status, org_id
  FROM organization_users
  WHERE id = user_id_to_toggle;
  
  -- If setting to secondary main user, grant all permissions
  IF current_status = false THEN
    UPDATE organization_users
    SET 
      is_secondary_main_user = true,
      title = 'Secondary User',
      can_add_vehicles = true,
      can_edit_vehicles = true,
      can_delete_vehicles = true,
      can_add_drivers = true,
      can_edit_drivers = true,
      can_delete_drivers = true,
      can_view_reports = true,
      can_edit_organization_info = true,
      can_view_fuel_transactions = true,
      can_create_reports = true,
      can_view_custom_reports = true,
      can_manage_users = true,
      can_view_financial_data = true
    WHERE id = user_id_to_toggle;
  ELSE
    -- If removing secondary main user status, just toggle the flag
    -- Permissions remain unchanged so they can be manually adjusted
    UPDATE organization_users
    SET is_secondary_main_user = false
    WHERE id = user_id_to_toggle;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
