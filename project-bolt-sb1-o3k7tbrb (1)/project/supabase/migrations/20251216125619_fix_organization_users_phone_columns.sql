/*
  # Fix Organization Users Phone Columns

  1. Changes
    - Add `phone_mobile` column if it doesn't exist
    - Copy data from `mobile_number` to `phone_mobile` if needed
    - Add `phone_office` column if it doesn't exist  
    - Copy data from `phone_number` to `phone_office` if needed

  2. Notes
    - This ensures compatibility with the application code
    - Existing data is preserved
    - Both old and new column names will work
*/

DO $$
BEGIN
  -- Add phone_mobile column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'phone_mobile'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN phone_mobile text;
    
    -- Copy data from mobile_number to phone_mobile
    UPDATE organization_users SET phone_mobile = mobile_number WHERE mobile_number IS NOT NULL;
  END IF;

  -- Add phone_office column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'phone_office'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN phone_office text;
    
    -- Copy data from phone_number to phone_office
    UPDATE organization_users SET phone_office = phone_number WHERE phone_number IS NOT NULL;
  END IF;
END $$;
