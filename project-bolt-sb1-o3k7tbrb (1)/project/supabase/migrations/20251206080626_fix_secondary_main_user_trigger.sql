/*
  # Fix Secondary Main User Trigger
  
  1. Problem
    - The trigger was automatically setting is_secondary_main_user = true when title is 'Secondary Main User'
    - This allowed users to become Secondary Main Users by just changing the title dropdown
    - Users should ONLY become Secondary Main Users through the nomination process
    
  2. Changes
    - Update the trigger to NOT automatically set is_secondary_main_user based on title
    - Keep the auto-granting of permissions when title is 'Secondary Main User'
    - The title field should be set automatically by the other trigger based on is_secondary_main_user flag
    
  3. Security
    - Ensures Secondary Main User status can only be granted through proper nomination
    - Maintains data integrity
*/

-- Update the function to NOT automatically set is_secondary_main_user
CREATE OR REPLACE FUNCTION auto_grant_secondary_main_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- If the title is 'Secondary Main User', grant all permissions
  -- But DO NOT automatically set is_secondary_main_user = true
  -- That should only be set through the toggle function
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
    -- REMOVED: NEW.is_secondary_main_user := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
