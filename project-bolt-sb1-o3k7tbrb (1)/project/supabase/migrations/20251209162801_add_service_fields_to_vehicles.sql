/*
  # Add Service Fields to Vehicles

  1. Changes
    - Add `last_service_date` column to vehicles table
      - Type: date
      - Nullable: yes (vehicles may not have been serviced yet)
    - Add `service_interval_km` column to vehicles table
      - Type: integer
      - Nullable: yes (service interval in kilometers, e.g., 10000 for every 10,000 km)
      - Default: null

  2. Purpose
    - Track when vehicles were last serviced
    - Define service intervals for maintenance scheduling
*/

-- Add service tracking fields to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_service_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'service_interval_km'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN service_interval_km integer;
  END IF;
END $$;