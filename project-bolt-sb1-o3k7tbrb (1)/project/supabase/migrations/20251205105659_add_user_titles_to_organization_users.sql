/*
  # Add User Titles to Organization Users

  1. Changes
    - Add `title` column to organization_users table
    - Valid titles: 'Main User', 'Billing User', 'Fleet User', 'Driver User', 'User'
    - Set existing main users to 'Main User'
    - Set other existing users to 'User' by default
    
  2. Notes
    - Title must be set when creating a user
    - Title helps identify the user's role in the organization
    - Display format: Title - Name - Email Address
*/

-- Add title column to organization_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'title'
  ) THEN
    ALTER TABLE organization_users 
    ADD COLUMN title text DEFAULT 'User';
  END IF;
END $$;

-- Add check constraint for valid titles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_users_title_check'
  ) THEN
    ALTER TABLE organization_users 
    ADD CONSTRAINT organization_users_title_check 
    CHECK (title IN ('Main User', 'Billing User', 'Fleet User', 'Driver User', 'User'));
  END IF;
END $$;

-- Update existing users based on is_main_user flag
UPDATE organization_users
SET title = CASE 
  WHEN is_main_user = true THEN 'Main User'
  ELSE 'User'
END
WHERE title IS NULL OR title = 'User';