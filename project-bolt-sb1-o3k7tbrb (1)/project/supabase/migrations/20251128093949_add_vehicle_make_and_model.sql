/*
  # Add Vehicle Make and Model
  
  1. Changes
    - Add `make` column to `vehicles` table (e.g., Toyota, Ford, Mercedes)
    - Add `model` column to `vehicles` table (e.g., Corolla, F-150, C-Class)
    - Both fields are optional to support existing vehicles
    
  2. Notes
    - Columns are nullable to avoid breaking existing data
    - Type is text to support all vehicle manufacturers and models
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'make'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN make text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'model'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN model text;
  END IF;
END $$;
