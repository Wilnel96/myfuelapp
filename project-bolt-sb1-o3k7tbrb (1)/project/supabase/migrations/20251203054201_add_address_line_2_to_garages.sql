/*
  # Add address_line_2 to garages table

  1. Changes
    - Add `address_line_2` column to garages table
    - Rename existing `address` column to `address_line_1` for consistency
    
  2. Notes
    - All fields are nullable to support gradual migration
*/

DO $$
BEGIN
  -- Add address_line_2 if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'address_line_2'
  ) THEN
    ALTER TABLE garages ADD COLUMN address_line_2 text;
  END IF;

  -- Rename address to address_line_1 if not already renamed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'address'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'address_line_1'
  ) THEN
    ALTER TABLE garages RENAME COLUMN address TO address_line_1;
  END IF;
END $$;
