/*
# Add next_service_date column and restrict service field updates to service-type only

## Changes
1. Add next_service_date column to vehicles (date when next service is due)
2. Update trigger to also compute next_service_date from last_service_date + service_interval_months (or a default 6 months)
3. Add service_interval_months column for time-based service scheduling
*/

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS next_service_date date,
  ADD COLUMN IF NOT EXISTS service_interval_months integer DEFAULT 6;

-- Backfill next_service_date from last_service_date + 6 months where missing
UPDATE vehicles
SET next_service_date = last_service_date + (COALESCE(service_interval_months, 6) || ' months')::interval
WHERE next_service_date IS NULL
  AND last_service_date IS NOT NULL;

-- Recreate the trigger function to also set next_service_date
CREATE OR REPLACE FUNCTION update_vehicle_service_from_maintenance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update vehicle service fields when maintenance_type = 'service'
  IF NEW.maintenance_type = 'service' THEN
    UPDATE vehicles
    SET
      last_service_date = NEW.maintenance_date,
      last_service_km_reading = NEW.odometer_reading,
      next_service_km = CASE
        WHEN NEW.odometer_reading IS NOT NULL
         AND service_interval_km IS NOT NULL
         AND service_interval_km > 0
        THEN NEW.odometer_reading + service_interval_km
        ELSE next_service_km
      END,
      next_service_date = CASE
        WHEN NEW.maintenance_date IS NOT NULL
        THEN NEW.maintenance_date + (COALESCE(service_interval_months, 6) || ' months')::interval
        ELSE next_service_date
      END
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill all vehicles from their latest service record
UPDATE vehicles v
SET
  last_service_date = sub.maintenance_date,
  last_service_km_reading = sub.odometer_reading,
  next_service_km = CASE
    WHEN sub.odometer_reading IS NOT NULL
     AND v.service_interval_km IS NOT NULL
     AND v.service_interval_km > 0
    THEN sub.odometer_reading + v.service_interval_km
    ELSE v.next_service_km
  END,
  next_service_date = CASE
    WHEN sub.maintenance_date IS NOT NULL
    THEN sub.maintenance_date + (COALESCE(v.service_interval_months, 6) || ' months')::interval
    ELSE v.next_service_date
  END
FROM (
  SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    maintenance_date,
    odometer_reading
  FROM vehicle_maintenance_records
  WHERE maintenance_type = 'service'
  ORDER BY vehicle_id, maintenance_date DESC
) sub
WHERE v.id = sub.vehicle_id;
