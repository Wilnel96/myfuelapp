/*
  # Add Phone Numbers to Organization Users

  1. Changes
    - Add `phone_office` column to `organization_users` table
    - Add `phone_mobile` column to `organization_users` table
  
  2. Notes
    - Both fields are optional (nullable)
    - Fields are text type to accommodate international formats and extensions
*/

-- Add phone number columns to organization_users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'phone_office'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN phone_office text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'phone_mobile'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN phone_mobile text;
  END IF;
END $$;