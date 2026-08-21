/*
# Add License Renewal and Insurance maintenance types

## Purpose
Expands the maintenance_type constraint on vehicle_maintenance_records to include
two new categories: 'license_renewal' and 'insurance'. This lets fleet managers
log vehicle license renewals and insurance payments alongside service and other
maintenance records.

## Changes
- Modified table: vehicle_maintenance_records
  - maintenance_type CHECK constraint updated to allow: 'service', 'other', 'license_renewal', 'insurance'
  - The old constraint is dropped and replaced with the expanded one.
- No new columns, no new tables, no RLS policy changes.

## Important Notes
1. Existing records ('service', 'other') remain valid under the new constraint.
2. The trigger that auto-updates vehicle service fields only fires for 'service' type,
   so license_renewal and insurance records will NOT affect last_service_date / next_service_km.
*/

ALTER TABLE vehicle_maintenance_records
  DROP CONSTRAINT IF EXISTS vehicle_maintenance_records_maintenance_type_check;

ALTER TABLE vehicle_maintenance_records
  ADD CONSTRAINT vehicle_maintenance_records_maintenance_type_check
  CHECK (maintenance_type IN ('service', 'other', 'license_renewal', 'insurance'));
