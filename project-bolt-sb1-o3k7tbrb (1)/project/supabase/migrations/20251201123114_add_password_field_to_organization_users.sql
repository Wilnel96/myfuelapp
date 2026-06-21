/*
  # Add Password Field to Organization Users

  1. Changes
    - Add `password` column to `organization_users` table to store passwords for display purposes
    - This is separate from Supabase auth passwords and used for password management UI

  2. Notes
    - Passwords will be stored as plain text for management purposes
    - Only users with `can_manage_users` permission or main users can view these passwords
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_users' AND column_name = 'password'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN password text;
  END IF;
END $$;