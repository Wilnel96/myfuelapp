/*
  # Sync User Titles with Boolean Flags

  1. Purpose
    - Ensure users with "Secondary Main User" title have is_secondary_main_user = true
    - Fix data inconsistency where title doesn't match the boolean flags
    
  2. Changes
    - Update Jean's is_secondary_main_user flag to match title
    - Create trigger to keep title and flags in sync
*/

-- Update Jean's secondary main user flag to match the title
UPDATE organization_users
SET is_secondary_main_user = true
WHERE email = 'jean@fleet.com'
AND title = 'Secondary Main User'
AND is_secondary_main_user = false;

-- Create a trigger to keep title and flags in sync
CREATE OR REPLACE FUNCTION sync_title_with_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- If title is "Main User", set is_main_user to true
  IF NEW.title = 'Main User' THEN
    NEW.is_main_user := true;
    NEW.is_secondary_main_user := false;
  -- If title is "Secondary Main User", set is_secondary_main_user to true
  ELSIF NEW.title = 'Secondary Main User' THEN
    NEW.is_secondary_main_user := true;
  -- For other titles, clear both flags unless explicitly set
  ELSE
    -- Only clear if they weren't explicitly set to true
    IF OLD.title IN ('Main User', 'Secondary Main User') AND NEW.title NOT IN ('Main User', 'Secondary Main User') THEN
      NEW.is_main_user := false;
      NEW.is_secondary_main_user := false;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for insert and update
DROP TRIGGER IF EXISTS ensure_title_flag_consistency ON organization_users;
CREATE TRIGGER ensure_title_flag_consistency
  BEFORE INSERT OR UPDATE OF title ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_title_with_flags();
