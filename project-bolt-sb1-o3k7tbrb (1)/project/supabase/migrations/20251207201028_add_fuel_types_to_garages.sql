/*
  # Add fuel types to garages

  1. Changes
    - Add `fuel_types` column to `garages` table (text array)
    - Column stores which fuel types the garage offers
    - Available fuel types: ULP-93, ULP-95, Diesel-10, Diesel-50, Diesel-500
  
  2. Notes
    - Column defaults to empty array
    - Allows NULL for backwards compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'fuel_types'
  ) THEN
    ALTER TABLE garages ADD COLUMN fuel_types text[] DEFAULT '{}';
  END IF;
END $$;