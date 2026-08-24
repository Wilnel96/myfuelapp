/*
# Make odometer reading required for maintenance records

## Summary
Backfills any NULL odometer_reading values in vehicle_maintenance_records to 0,
then sets the column to NOT NULL so future inserts/updates must always provide a value.

## Changes
1. Backfill: SET odometer_reading = 0 WHERE odometer_reading IS NULL
2. Alter: odometer_reading integer NOT NULL DEFAULT 0
*/

UPDATE vehicle_maintenance_records
SET odometer_reading = 0
WHERE odometer_reading IS NULL;

ALTER TABLE vehicle_maintenance_records
ALTER COLUMN odometer_reading SET NOT NULL;

ALTER TABLE vehicle_maintenance_records
ALTER COLUMN odometer_reading SET DEFAULT 0;
