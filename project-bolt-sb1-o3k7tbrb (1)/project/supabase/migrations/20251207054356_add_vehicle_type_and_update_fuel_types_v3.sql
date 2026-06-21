/*
  # Add Vehicle Type and Update Fuel Types

  1. Changes
    - Add `vehicle_type` column to vehicles table
      - Options: 'ULP', 'Diesel', 'Hybrid', 'Electric'
    - Update `fuel_type` column to reflect South African fuel types
      - Options: 'ULP-93', 'ULP-95', 'Diesel-10', 'Diesel-50', 'Diesel-500'
    - Migrate existing data to new fuel type values
    - Note: Electric vehicles don't use fuel, Hybrid vehicles can use ULP or Diesel fuel types
  
  2. Notes
    - Vehicle Type indicates the general category of vehicle
    - Fuel Type indicates the specific fuel used at purchase
    - Electric vehicles will have fuel_type as NULL
    - Hybrid vehicles should have both vehicle_type='Hybrid' and a fuel_type (ULP-93, ULP-95, Diesel-10, Diesel-50, or Diesel-500)
*/

-- Drop old fuel_type constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_fuel_type_check'
  ) THEN
    ALTER TABLE vehicles DROP CONSTRAINT vehicles_fuel_type_check;
  END IF;
END $$;

-- Add vehicle_type column to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN vehicle_type text;
  END IF;
END $$;

-- Migrate existing fuel_type data to new values and set vehicle_type
UPDATE vehicles 
SET 
  vehicle_type = CASE 
    WHEN fuel_type = 'gasoline' THEN 'ULP'
    WHEN fuel_type = 'diesel' THEN 'Diesel'
    WHEN fuel_type = 'electric' THEN 'Electric'
    WHEN fuel_type = 'hybrid' THEN 'Hybrid'
    ELSE 'ULP'
  END,
  fuel_type = CASE 
    WHEN fuel_type = 'gasoline' THEN 'ULP-95'
    WHEN fuel_type = 'diesel' THEN 'Diesel-50'
    WHEN fuel_type = 'electric' THEN NULL
    WHEN fuel_type = 'hybrid' THEN 'ULP-95'
    ELSE fuel_type
  END
WHERE vehicle_type IS NULL;

-- Add new constraint with South African fuel types (allowing NULL for electric vehicles)
ALTER TABLE vehicles ADD CONSTRAINT vehicles_fuel_type_check 
  CHECK (fuel_type IS NULL OR fuel_type IN ('ULP-93', 'ULP-95', 'Diesel-10', 'Diesel-50', 'Diesel-500'));

-- Add check constraint for vehicle_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vehicle_type_check'
  ) THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_type_check 
      CHECK (vehicle_type IN ('ULP', 'Diesel', 'Hybrid', 'Electric'));
  END IF;
END $$;