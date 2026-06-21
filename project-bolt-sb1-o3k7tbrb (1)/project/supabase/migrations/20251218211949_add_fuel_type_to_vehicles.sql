/*
  # Add fuel_type column to vehicles table

  1. Changes
    - Add `fuel_type` column to `vehicles` table to track specific fuel requirements
    - This enables fuel validation when drivers attempt to refuel
    - Prevents incorrect fuel types (e.g., ULP in diesel vehicles)

  2. Details
    - Column is nullable to support Electric vehicles
    - Uses text type to store values like 'ULP-93', 'ULP-95', 'Diesel-10', 'Diesel-50', 'Diesel-500'
*/

-- Add fuel_type column to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN fuel_type text;
  END IF;
END $$;
