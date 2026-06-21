/*
  # Add missing address fields to drivers table

  1. Changes
    - Rename `address` column to `address_line_1` for consistency
    - Add `address_line_2` column to drivers table
    - Add `city` column to drivers table
    - Add `province` column to drivers table
    - Add `postal_code` column to drivers table
    
  2. Notes
    - All new fields are nullable to support existing data
    - Existing `address` data will be preserved in `address_line_1`
*/

DO $$
BEGIN
  -- Rename address to address_line_1 if not already renamed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'address'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'address_line_1'
  ) THEN
    ALTER TABLE drivers RENAME COLUMN address TO address_line_1;
  END IF;

  -- Add address_line_2 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'address_line_2'
  ) THEN
    ALTER TABLE drivers ADD COLUMN address_line_2 text;
  END IF;

  -- Add city if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'city'
  ) THEN
    ALTER TABLE drivers ADD COLUMN city text;
  END IF;

  -- Add province if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'province'
  ) THEN
    ALTER TABLE drivers ADD COLUMN province text;
  END IF;

  -- Add postal_code if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE drivers ADD COLUMN postal_code text;
  END IF;
END $$;