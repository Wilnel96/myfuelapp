/*
  # Auto-add Management Organization Users to organization_users

  1. Changes
    - Create trigger to automatically add users to organization_users table
    - Applies to all organizations, not just management org
    - Ensures all new users get organization_users entries
    
  2. Details
    - When a new profile is created with an organization_id
    - Automatically creates corresponding organization_users entry
    - Splits full_name into name and surname
    - Sets default permissions (all false except view permissions)
    - Super admins get full permissions and is_main_user = true
*/

-- Function to auto-create organization_users entry when profile is created
CREATE OR REPLACE FUNCTION auto_create_organization_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create organization_user if organization_id is set
  IF NEW.organization_id IS NOT NULL THEN
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
    VALUES (
      NEW.organization_id,
      NEW.id,
      NEW.email,
      COALESCE(SPLIT_PART(NEW.full_name, ' ', 1), 'User'),
      COALESCE(NULLIF(SUBSTRING(NEW.full_name FROM POSITION(' ' IN NEW.full_name) + 1), ''), 'Name'),
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      true,
      (NEW.role = 'super_admin'),
      true,
      (NEW.role = 'super_admin'),
      true,
      (NEW.role = 'super_admin'),
      (NEW.role = 'super_admin'),
      true
    )
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_create_organization_user_trigger ON profiles;

-- Create trigger on profiles table
CREATE TRIGGER auto_create_organization_user_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_organization_user();
