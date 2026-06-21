/*
  # Update Title Constraint and Auto-update User Title on Role Change

  1. Changes
    - Updates the check constraint on organization_users.title to include 'Secondary Main User'
    - Creates a function to automatically update the title field when is_main_user or is_secondary_main_user changes
    - Creates a trigger on organization_users to call this function before insert or update
    
  2. Logic
    - If is_main_user = true, title is set to 'Main User'
    - If is_secondary_main_user = true, title is set to 'Secondary Main User'
    - Otherwise, title remains as set by the user
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Trigger ensures consistency between role flags and title field
*/

-- Drop the old constraint
ALTER TABLE organization_users 
DROP CONSTRAINT IF EXISTS organization_users_title_check;

-- Add the new constraint with 'Secondary Main User' included
ALTER TABLE organization_users
ADD CONSTRAINT organization_users_title_check 
CHECK (title IN ('Main User', 'Secondary Main User', 'Secondary User', 'Billing User', 'Fleet User', 'Driver User', 'User'));

-- Function to auto-update title based on role
CREATE OR REPLACE FUNCTION auto_update_user_title()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is being set as main user, update title
  IF NEW.is_main_user = true THEN
    NEW.title := 'Main User';
  -- If user is being set as secondary main user, update title
  ELSIF NEW.is_secondary_main_user = true THEN
    NEW.title := 'Secondary Main User';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update title on insert or update
DROP TRIGGER IF EXISTS trigger_auto_update_user_title ON organization_users;
CREATE TRIGGER trigger_auto_update_user_title
  BEFORE INSERT OR UPDATE OF is_main_user, is_secondary_main_user
  ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_user_title();

-- Update existing users to have correct titles
UPDATE organization_users
SET title = 'Main User'
WHERE is_main_user = true;

UPDATE organization_users
SET title = 'Secondary Main User'
WHERE is_secondary_main_user = true AND NOT is_main_user;