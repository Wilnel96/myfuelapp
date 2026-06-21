/*
  # Add VIN Number to Vehicles Table

  1. Changes
    - Add `vin_number` column to `vehicles` table
    - VIN number is required for vehicle authentication
    - VIN must be unique within each organization
  
  2. Security
    - No RLS changes needed (existing policies apply)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'vin_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN vin_number text;
    
    -- Add unique constraint for VIN within organization
    CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_vin_unique 
    ON vehicles(organization_id, vin_number) 
    WHERE vin_number IS NOT NULL;
  END IF;
END $$;