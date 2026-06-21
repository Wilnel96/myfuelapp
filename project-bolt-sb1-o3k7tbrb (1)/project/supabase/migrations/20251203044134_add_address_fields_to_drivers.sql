/*
  # Add structured address fields to drivers table

  1. Changes
    - Add `city` column to drivers table
    - Add `province` column to drivers table
    - Add `postal_code` column to drivers table
    
  2. Notes
    - Existing `address` field will remain for street address
    - All new fields are nullable to support gradual migration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'city'
  ) THEN
    ALTER TABLE drivers ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'province'
  ) THEN
    ALTER TABLE drivers ADD COLUMN province text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE drivers ADD COLUMN postal_code text;
  END IF;
END $$;
