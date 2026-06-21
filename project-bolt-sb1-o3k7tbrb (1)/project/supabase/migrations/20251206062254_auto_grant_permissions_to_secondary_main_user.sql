/*
  # Auto-grant Permissions to Secondary Main User

  1. Changes
    - Creates a function to automatically grant all permissions when a user's title is changed to 'Secondary Main User'
    - Creates a trigger to call this function before insert or update on organization_users
    - Also sets is_secondary_main_user to true when title is 'Secondary Main User'

  2. Logic
    - When title is set to 'Secondary Main User', all permissions are automatically granted
    - When title is changed from 'Secondary Main User' to something else, permissions remain unchanged

  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures consistency between title and permissions
*/

-- Function to auto-grant permissions when title is Secondary Main User
CREATE OR REPLACE FUNCTION auto_grant_secondary_main_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- If the title is being set to 'Secondary Main User', grant all permissions
  IF NEW.title = 'Secondary Main User' THEN
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
    NEW.can_view_financial_data := true;
    NEW.is_secondary_main_user := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-grant permissions on insert or update
DROP TRIGGER IF EXISTS trigger_auto_grant_secondary_main_user_permissions ON organization_users;
CREATE TRIGGER trigger_auto_grant_secondary_main_user_permissions
  BEFORE INSERT OR UPDATE OF title
  ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION auto_grant_secondary_main_user_permissions();
