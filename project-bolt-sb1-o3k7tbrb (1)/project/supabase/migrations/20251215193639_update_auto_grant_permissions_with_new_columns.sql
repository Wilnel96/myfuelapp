/*
  # Update Auto-Grant Permissions Function

  1. Changes
    - Updates the auto_grant_main_user_permissions function to include the newly added permission columns
    - Ensures main users and secondary main users get all permissions automatically

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures consistency between role and all permissions
*/

-- Update function to include new permission columns
CREATE OR REPLACE FUNCTION auto_grant_main_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being set to main_user or secondary_main_user, grant all permissions
  IF NEW.role IN ('main_user', 'secondary_main_user') THEN
    NEW.can_add_vehicles := true;
    NEW.can_edit_vehicles := true;
    NEW.can_delete_vehicles := true;
    NEW.can_add_drivers := true;
    NEW.can_edit_drivers := true;
    NEW.can_delete_drivers := true;
    NEW.can_view_reports := true;
    NEW.can_edit_organization_info := true;
    NEW.can_view_fuel_transactions := true;
    NEW.can_create_reports := true;
    NEW.can_view_custom_reports := true;
    NEW.can_manage_users := true;
    NEW.can_manage_garages := true;
    NEW.can_process_eft := true;
    NEW.can_view_financial_info := true;
    NEW.can_edit_financial_info := true;
    NEW.can_view_financial_data := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
