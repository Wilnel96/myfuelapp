/*
  # Auto-grant Permissions for Main Users

  1. Changes
    - Creates a function to automatically grant all permissions when role is set to 'main_user' or 'secondary_main_user'
    - Creates a trigger to call this function before insert or update on organization_users
    - Backfills existing main users and secondary main users with all permissions

  2. Logic
    - When role is set to 'main_user' or 'secondary_main_user', all permissions are automatically granted
    - When role is changed from main_user/secondary_main_user to 'user', permissions remain unchanged

  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures consistency between role and permissions
*/

-- Function to auto-grant permissions when role is main_user or secondary_main_user
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
    NEW.can_manage_users := true;
    NEW.can_manage_garages := true;
    NEW.can_process_eft := true;
    NEW.can_view_financial_info := true;
    NEW.can_edit_financial_info := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-grant permissions on insert or update
DROP TRIGGER IF EXISTS trigger_auto_grant_main_user_permissions ON organization_users;
CREATE TRIGGER trigger_auto_grant_main_user_permissions
  BEFORE INSERT OR UPDATE OF role
  ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION auto_grant_main_user_permissions();

-- Backfill existing users with main_user or secondary_main_user role to have all permissions
UPDATE organization_users
SET
  can_add_vehicles = true,
  can_edit_vehicles = true,
  can_delete_vehicles = true,
  can_add_drivers = true,
  can_edit_drivers = true,
  can_delete_drivers = true,
  can_view_reports = true,
  can_manage_users = true,
  can_manage_garages = true,
  can_process_eft = true,
  can_view_financial_info = true,
  can_edit_financial_info = true
WHERE role IN ('main_user', 'secondary_main_user');
