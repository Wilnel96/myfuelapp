/*
  # Add Missing Columns to Vehicles Table
  
  1. Changes
    - Add make: Vehicle manufacturer (e.g., Toyota, Ford)
    - Add model: Vehicle model name (e.g., Corolla, F-150)
    - Add year: Manufacturing year
    - Add license_disk_expiry: License disk expiration date
    - Add initial_odometer_reading: Opening odometer reading when vehicle is added
    - Add average_fuel_consumption_per_100km: Average fuel consumption for tracking
    - Add tank_capacity: Fuel tank capacity in liters
    - Add vin_number: Vehicle Identification Number
    - Add vehicle_type: Type of vehicle/fuel (ULP, Diesel, Electric, etc.)
    - Add last_service_date: Date of last service
    - Add service_interval_km: Service interval in kilometers
    - Add deleted_at: Soft delete timestamp
  
  2. Notes
    - All critical fields are marked as NOT NULL with appropriate defaults
    - Optional fields allow NULL values
    - Soft delete is implemented via deleted_at timestamp
*/

-- Add all missing columns to vehicles table
DO $$
BEGIN
  -- Add make column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'make'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN make text NOT NULL DEFAULT '';
  END IF;

  -- Add model column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'model'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN model text NOT NULL DEFAULT '';
  END IF;

  -- Add year column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'year'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  END IF;

  -- Add license_disk_expiry column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'license_disk_expiry'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN license_disk_expiry date;
  END IF;

  -- Add initial_odometer_reading column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'initial_odometer_reading'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN initial_odometer_reading numeric NOT NULL DEFAULT 0;
  END IF;

  -- Add average_fuel_consumption_per_100km column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'average_fuel_consumption_per_100km'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN average_fuel_consumption_per_100km numeric NOT NULL DEFAULT 10;
  END IF;

  -- Add tank_capacity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'tank_capacity'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN tank_capacity numeric;
  END IF;

  -- Add vin_number column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'vin_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN vin_number text;
  END IF;

  -- Add vehicle_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN vehicle_type text;
  END IF;

  -- Add last_service_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_service_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_date date;
  END IF;

  -- Add service_interval_km column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'service_interval_km'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN service_interval_km integer;
  END IF;

  -- Add deleted_at column for soft deletes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN vehicles.make IS 'Vehicle manufacturer (e.g., Toyota, Ford)';
COMMENT ON COLUMN vehicles.model IS 'Vehicle model name (e.g., Corolla, F-150)';
COMMENT ON COLUMN vehicles.year IS 'Manufacturing year';
COMMENT ON COLUMN vehicles.license_disk_expiry IS 'License disk expiration date';
COMMENT ON COLUMN vehicles.initial_odometer_reading IS 'Opening odometer reading when vehicle is added';
COMMENT ON COLUMN vehicles.average_fuel_consumption_per_100km IS 'Average fuel consumption per 100km for tracking';
COMMENT ON COLUMN vehicles.tank_capacity IS 'Fuel tank capacity in liters';
COMMENT ON COLUMN vehicles.vin_number IS 'Vehicle Identification Number';
COMMENT ON COLUMN vehicles.vehicle_type IS 'Type of vehicle/fuel (ULP, Diesel, Electric, etc.)';
COMMENT ON COLUMN vehicles.last_service_date IS 'Date of last service';
COMMENT ON COLUMN vehicles.service_interval_km IS 'Service interval in kilometers';
COMMENT ON COLUMN vehicles.deleted_at IS 'Soft delete timestamp - NULL means active, non-NULL means deleted';