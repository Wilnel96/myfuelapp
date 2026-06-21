/*
  # Add Last Service KM Reading to Vehicles

  1. Changes
    - Add `last_service_km_reading` column to vehicles table
      - Type: integer
      - Nullable: yes (vehicles may not have been serviced yet)
      - Description: Odometer reading in kilometers at the time of last service
  
  2. Purpose
    - Enables service due tracking based on actual km driven since last service
    - Combined with service_interval_km, calculates when next service is due
    - Used for "Vehicles to be Serviced" and "Vehicles Overdue for Service" reports
  
  3. Notes
    - Next service km = last_service_km_reading + service_interval_km
    - Km until service = next_service_km - current_odometer
    - Service due soon: km_until_service <= 1000 and > 0
    - Service overdue: km_until_service < 0
*/

-- Add last_service_km_reading column to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_service_km_reading'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_km_reading integer;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN vehicles.last_service_km_reading IS 'Odometer reading in kilometers at the time of last service';
