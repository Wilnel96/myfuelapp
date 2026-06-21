/*
  # Add Function to Remove Secondary Main User with New Role Assignment
  
  1. Changes
    - Creates a new function remove_secondary_main_user_with_role that accepts:
      - user_id_to_demote: UUID of the user to demote
      - new_title: The new title to assign
      - new_permissions: JSONB object with all permission flags
    - This function properly demotes a Secondary Main User and assigns them a new role with specific permissions
    
  2. Logic
    - Validates that the user is currently a Secondary Main User
    - Sets is_secondary_main_user to false
    - Updates title to the new specified title
    - Updates all permission flags based on the provided new_permissions object
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures data integrity when demoting Secondary Main Users
*/

CREATE OR REPLACE FUNCTION remove_secondary_main_user_with_role(
  user_id_to_demote uuid,
  new_title text,
  new_permissions jsonb
)
RETURNS void AS $$
BEGIN
  -- Update the user with new role and permissions
  UPDATE organization_users
  SET 
    is_secondary_main_user = false,
    title = new_title,
    can_add_vehicles = COALESCE((new_permissions->>'can_add_vehicles')::boolean, false),
    can_edit_vehicles = COALESCE((new_permissions->>'can_edit_vehicles')::boolean, false),
    can_delete_vehicles = COALESCE((new_permissions->>'can_delete_vehicles')::boolean, false),
    can_add_drivers = COALESCE((new_permissions->>'can_add_drivers')::boolean, false),
    can_edit_drivers = COALESCE((new_permissions->>'can_edit_drivers')::boolean, false),
    can_delete_drivers = COALESCE((new_permissions->>'can_delete_drivers')::boolean, false),
    can_view_reports = COALESCE((new_permissions->>'can_view_reports')::boolean, false),
    can_edit_organization_info = COALESCE((new_permissions->>'can_edit_organization_info')::boolean, false),
    can_view_fuel_transactions = COALESCE((new_permissions->>'can_view_fuel_transactions')::boolean, false),
    can_create_reports = COALESCE((new_permissions->>'can_create_reports')::boolean, false),
    can_view_custom_reports = COALESCE((new_permissions->>'can_view_custom_reports')::boolean, false),
    can_manage_users = COALESCE((new_permissions->>'can_manage_users')::boolean, false),
    can_view_financial_data = COALESCE((new_permissions->>'can_view_financial_data')::boolean, false)
  WHERE id = user_id_to_demote 
    AND is_secondary_main_user = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a Secondary Main User or does not exist';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
