/*
  # Update toggle_secondary_main_user Function

  1. Changes
    - Updates the toggle_secondary_main_user function to use 'Secondary Main User' instead of 'Secondary User'
    - Ensures consistency with the new naming convention

  2. Security
    - Maintains SECURITY DEFINER to bypass RLS
    - No changes to permission logic
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
      title = 'Secondary Main User',
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
