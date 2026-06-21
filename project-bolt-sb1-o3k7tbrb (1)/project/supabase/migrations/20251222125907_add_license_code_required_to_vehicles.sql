/*
  # Add License Code Requirement to Vehicles

  1. Changes
    - Add `license_code_required` column to vehicles table
    - Column stores the minimum license code required to drive the vehicle
    - Defaults to 'Code B' (standard car license)

  2. License Code Options (South African License Codes)
    - Code A1: Motorcycles (learner)
    - Code A: Motorcycles (full)
    - Code B: Light motor vehicles (up to 3500kg)
    - Code C1: Light goods vehicles (3500-16000kg)
    - Code C: Heavy goods vehicles (over 16000kg)
    - Code EB: Light vehicle with trailer
    - Code EC1: Light truck with trailer
    - Code EC: Heavy truck with trailer

  3. Validation Function
    - Create function to validate if driver's license qualifies for vehicle
    - Uses license code hierarchy to determine qualification
*/

-- Add license_code_required column to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'license_code_required'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN license_code_required text NOT NULL DEFAULT 'Code B';
  END IF;
END $$;

-- Create function to check if a driver's license qualifies for a vehicle
CREATE OR REPLACE FUNCTION check_driver_license_qualifies(
  p_driver_license_code text,
  p_vehicle_license_required text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  -- Define license hierarchy levels
  v_driver_level int;
  v_required_level int;
BEGIN
  -- Map license codes to hierarchy levels
  -- Higher numbers = more qualified
  v_driver_level := CASE p_driver_license_code
    WHEN 'Code A1' THEN 1
    WHEN 'Code A' THEN 2
    WHEN 'Code B' THEN 3
    WHEN 'Code EB' THEN 4
    WHEN 'Code C1' THEN 5
    WHEN 'Code EC1' THEN 6
    WHEN 'Code C' THEN 7
    WHEN 'Code EC' THEN 8
    ELSE 0  -- Unknown license code = not qualified
  END;

  v_required_level := CASE p_vehicle_license_required
    WHEN 'Code A1' THEN 1
    WHEN 'Code A' THEN 2
    WHEN 'Code B' THEN 3
    WHEN 'Code EB' THEN 4
    WHEN 'Code C1' THEN 5
    WHEN 'Code EC1' THEN 6
    WHEN 'Code C' THEN 7
    WHEN 'Code EC' THEN 8
    ELSE 0
  END;

  -- Driver qualifies if their level is >= required level
  RETURN v_driver_level >= v_required_level;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION check_driver_license_qualifies(text, text) TO authenticated, anon, service_role;

-- Add comment to the column
COMMENT ON COLUMN vehicles.license_code_required IS 'Minimum license code required to legally drive this vehicle';
