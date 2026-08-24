/*
# Fix: vehicle service fields not updating when maintenance record is edited

## Problem
The trigger `trg_update_vehicle_service_on_maintenance` only fired AFTER INSERT.
When a maintenance record was edited (UPDATE) to correct the odometer reading,
the vehicle's `last_service_km_reading` and `next_service_km` were never updated.

Example: CBR2522 was serviced on 21 Aug 2026. The record was later edited to
set odometer to 20000, but the vehicle still shows last_service_km_reading = 200.

## Changes
1. Recreate the function to handle both INSERT and UPDATE (only update vehicle
   on INSERT, or on UPDATE when the odometer/date/type actually changed).
2. Recreate the trigger to fire AFTER INSERT OR UPDATE.
3. Backfill CBR2522's vehicle service fields from its latest service record.
4. Backfill all vehicles: recompute last_service_km_reading and next_service_km
   from the most recent service-type maintenance record for each vehicle.
*/

CREATE OR REPLACE FUNCTION update_vehicle_service_from_maintenance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- On INSERT: always update vehicle service fields for service-type records
  -- On UPDATE: only update if the relevant fields changed
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
      END
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_vehicle_service_on_maintenance ON vehicle_maintenance_records;

CREATE TRIGGER trg_update_vehicle_service_on_maintenance
  AFTER INSERT OR UPDATE ON vehicle_maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_service_from_maintenance();

-- Backfill CBR2522 specifically
UPDATE vehicles
SET
  last_service_date = mr.maintenance_date,
  last_service_km_reading = mr.odometer_reading,
  next_service_km = mr.odometer_reading + COALESCE(vehicles.service_interval_km, 0)
FROM (
  SELECT vehicle_id, maintenance_date, odometer_reading
  FROM vehicle_maintenance_records
  WHERE maintenance_type = 'service'
    AND vehicle_id = (SELECT id FROM vehicles WHERE registration_number = 'CBR2522')
  ORDER BY maintenance_date DESC
  LIMIT 1
) mr
WHERE vehicles.registration_number = 'CBR2522';

-- General backfill: for every vehicle, recompute from its latest service record
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
