/*
  # Add Secondary Main User Support

  1. Changes
    - Add `is_secondary_main_user` field to organization_users table
    - Organizations can now have one main user and one secondary main user
    - Secondary main users have the same permissions as main users
    
  2. Purpose
    - Allow organizations to have a backup main user when the primary is unavailable
    - Provides continuity of management when main user is on holiday or unavailable
    
  3. Rules
    - Only one main user and one secondary main user allowed per organization
    - Main user can nominate/remove secondary main user
*/

-- Add is_secondary_main_user column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'is_secondary_main_user'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN is_secondary_main_user boolean DEFAULT false;
  END IF;
END $$;

-- Create function to toggle secondary main user status
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
  
  -- Toggle the status
  UPDATE organization_users
  SET is_secondary_main_user = NOT current_status
  WHERE id = user_id_to_toggle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to secondary main users (same as main users)
CREATE OR REPLACE FUNCTION auto_grant_permissions_to_secondary_main_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_secondary_main_user = true AND (OLD.is_secondary_main_user IS NULL OR OLD.is_secondary_main_user = false) THEN
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
    NEW.title := 'Secondary Main User';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-granting permissions
DROP TRIGGER IF EXISTS grant_secondary_main_user_permissions ON organization_users;
CREATE TRIGGER grant_secondary_main_user_permissions
  BEFORE UPDATE ON organization_users
  FOR EACH ROW
  WHEN (NEW.is_secondary_main_user = true AND (OLD.is_secondary_main_user IS NULL OR OLD.is_secondary_main_user = false))
  EXECUTE FUNCTION auto_grant_permissions_to_secondary_main_user();
