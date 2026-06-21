/*
  # Add Location Coordinates to Garages

  1. Changes
    - Add `latitude` column to garages table (numeric, nullable for existing records)
    - Add `longitude` column to garages table (numeric, nullable for existing records)
    
  2. Purpose
    - Enable distance calculation for mobile app users
    - Allow sorting garages by proximity to user's location
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE garages ADD COLUMN latitude numeric(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE garages ADD COLUMN longitude numeric(11, 8);
  END IF;
END $$;
