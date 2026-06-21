/*
  # Fix auto_create_organization_user trigger

  1. Changes
    - Fix the ON CONFLICT clause to use the correct unique constraint
    - The organization_users table has a unique constraint on (organization_id, email)
    - Not on (user_id, organization_id) which the trigger was trying to use

  2. Details
    - Update the function to use ON CONFLICT (organization_id, email) DO NOTHING
    - This will prevent errors when a user already exists in organization_users
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS auto_create_organization_user_trigger ON profiles;

-- Recreate the function with the correct ON CONFLICT clause
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
    ON CONFLICT (organization_id, email) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER auto_create_organization_user_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_organization_user();
