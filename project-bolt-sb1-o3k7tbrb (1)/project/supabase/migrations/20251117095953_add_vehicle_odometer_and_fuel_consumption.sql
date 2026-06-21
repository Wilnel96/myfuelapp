/*
  # Add Odometer and Fuel Consumption Fields to Vehicles

  1. Changes
    - Add initial_odometer_reading field to track opening odometer reading
    - Add average_fuel_consumption_per_100km field for fuel consumption calculation
    - Set default values for new fields

  2. Notes
    - initial_odometer_reading: Opening odometer reading when vehicle is added
    - average_fuel_consumption_per_100km: Used to calculate future fuel consumption
*/

-- Add new columns to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'initial_odometer_reading'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN initial_odometer_reading numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'average_fuel_consumption_per_100km'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN average_fuel_consumption_per_100km numeric NOT NULL DEFAULT 10;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN vehicles.initial_odometer_reading IS 'Opening odometer reading when vehicle is taken on';
COMMENT ON COLUMN vehicles.average_fuel_consumption_per_100km IS 'Estimated average fuel consumption per 100km for future consumption calculations';
