/*
  # Update Vehicle Types - Split Hybrid into HYBRID-ULP and HYBRID-DIESEL

  1. Changes
    - Remove old vehicle_type constraint
    - Update existing Hybrid vehicles to HYBRID-ULP or HYBRID-DIESEL based on fuel_type
    - Add new vehicle_type constraint with HYBRID-ULP and HYBRID-DIESEL options
  
  2. Migration Logic
    - Vehicles with vehicle_type=Hybrid and fuel_type containing ULP become HYBRID-ULP
    - Vehicles with vehicle_type=Hybrid and fuel_type containing Diesel become HYBRID-DIESEL
    - All vehicle types converted to UPPERCASE for consistency
*/

-- Drop old vehicle_type constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_vehicle_type_check'
  ) THEN
    ALTER TABLE vehicles DROP CONSTRAINT vehicles_vehicle_type_check;
  END IF;
END $$;

-- Update existing vehicles to new vehicle_type values
UPDATE vehicles 
SET vehicle_type = CASE 
  WHEN vehicle_type = 'Hybrid' AND fuel_type LIKE '%Diesel%' THEN 'HYBRID-DIESEL'
  WHEN vehicle_type = 'Hybrid' AND fuel_type LIKE '%ULP%' THEN 'HYBRID-ULP'
  WHEN vehicle_type = 'Hybrid' THEN 'HYBRID-ULP'
  WHEN UPPER(vehicle_type) = 'ULP' THEN 'ULP'
  WHEN UPPER(vehicle_type) = 'DIESEL' THEN 'DIESEL'
  WHEN UPPER(vehicle_type) = 'ELECTRIC' THEN 'ELECTRIC'
  ELSE UPPER(vehicle_type)
END
WHERE vehicle_type IS NOT NULL;

-- Add new vehicle_type constraint with split hybrid options
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_type_check 
  CHECK (vehicle_type IN ('ULP', 'DIESEL', 'HYBRID-ULP', 'HYBRID-DIESEL', 'ELECTRIC'));