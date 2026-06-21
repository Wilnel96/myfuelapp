/*
  # Add structured address fields to garages table

  1. Changes
    - Add `city` column to garages table
    - Add `province` column to garages table
    - Add `postal_code` column to garages table
    
  2. Notes
    - Existing `address` field will remain for street address
    - All new fields are nullable to support gradual migration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'city'
  ) THEN
    ALTER TABLE garages ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'province'
  ) THEN
    ALTER TABLE garages ADD COLUMN province text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE garages ADD COLUMN postal_code text;
  END IF;
END $$;
