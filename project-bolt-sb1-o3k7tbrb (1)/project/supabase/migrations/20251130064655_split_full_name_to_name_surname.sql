/*
  # Split full_name into name and surname in organization_users table

  1. Changes
    - Add `name` column to store first name
    - Add `surname` column to store last name
    - Migrate existing `full_name` data by splitting on first space
    - Remove `full_name` column
    
  2. Data Migration
    - Splits existing full names on the first space character
    - If no space exists, puts entire value in `name` field
    - Preserves all existing user data
    
  3. Notes
    - This change ensures consistency across the system
    - All contact person fields now use name/surname pattern
    - Maintains data integrity during migration
*/

-- Add new columns
ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS surname text;

-- Migrate existing data from full_name to name and surname
DO $$
BEGIN
  UPDATE organization_users
  SET 
    name = CASE 
      WHEN full_name IS NOT NULL AND position(' ' IN full_name) > 0 
      THEN split_part(full_name, ' ', 1)
      ELSE full_name
    END,
    surname = CASE 
      WHEN full_name IS NOT NULL AND position(' ' IN full_name) > 0 
      THEN substring(full_name FROM position(' ' IN full_name) + 1)
      ELSE ''
    END
  WHERE full_name IS NOT NULL;
END $$;

-- Drop the old full_name column
ALTER TABLE organization_users DROP COLUMN IF EXISTS full_name;