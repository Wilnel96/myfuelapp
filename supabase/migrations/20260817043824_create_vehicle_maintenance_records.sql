/*
# Create vehicle_maintenance_records table

## Purpose
Stores individual maintenance events (services, repairs, other work) for each vehicle,
enabling a maintenance history log and a total running-cost report combining fuel and maintenance spend.

## New Table: vehicle_maintenance_records
- id (uuid, PK)
- vehicle_id (uuid, FK to vehicles, ON DELETE CASCADE)
- organization_id (uuid, FK to organizations, ON DELETE CASCADE)
- maintenance_type (text: 'service' or 'other', NOT NULL, default 'service')
- description (text, NOT NULL) — what was done
- maintenance_date (date, NOT NULL) — when the work was performed
- odometer_reading (integer, nullable) — km at time of work
- cost (numeric(12,2), NOT NULL, default 0) — cost of the work
- workshop (text, nullable) — service provider / workshop name
- created_at (timestamptz, default now())
- created_by (uuid, nullable, FK to auth.users)

## Security — RLS
- RLS enabled on the table.
- SELECT: organization members can view records for their own vehicles; super_admin bypasses via existing vehicles policy pattern.
- INSERT: authenticated users can insert records for vehicles in their organization.
- UPDATE: authenticated users can update records for vehicles in their organization.
- DELETE: authenticated users can delete records for vehicles in their organization.
- Uses the same organization-scoping pattern as vehicles (EXISTS subquery on vehicles + organization membership check via profiles).

## Trigger
- After INSERT of a 'service' type record, updates the parent vehicle's last_service_date,
  last_service_km_reading, and next_service_km fields so service-due reports stay in sync.
*/

CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL DEFAULT 'service' CHECK (maintenance_type IN ('service', 'other')),
  description text NOT NULL,
  maintenance_date date NOT NULL,
  odometer_reading integer,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  workshop text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_records_vehicle_id ON vehicle_maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_records_org_id ON vehicle_maintenance_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_records_date ON vehicle_maintenance_records(maintenance_date);

ALTER TABLE vehicle_maintenance_records ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user belongs to the same organization as a record
-- Uses the same pattern as existing RLS policies in this project (profiles.organization_id match)
DROP POLICY IF EXISTS "select_own_maintenance_records" ON vehicle_maintenance_records;
CREATE POLICY "select_own_maintenance_records"
  ON vehicle_maintenance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_maintenance_records.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "insert_own_maintenance_records" ON vehicle_maintenance_records;
CREATE POLICY "insert_own_maintenance_records"
  ON vehicle_maintenance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_maintenance_records.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "update_own_maintenance_records" ON vehicle_maintenance_records;
CREATE POLICY "update_own_maintenance_records"
  ON vehicle_maintenance_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_maintenance_records.organization_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_maintenance_records.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "delete_own_maintenance_records" ON vehicle_maintenance_records;
CREATE POLICY "delete_own_maintenance_records"
  ON vehicle_maintenance_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_maintenance_records.organization_id
      )
    )
  );

-- Trigger: auto-update vehicle service fields when a 'service' type record is inserted
CREATE OR REPLACE FUNCTION update_vehicle_service_from_maintenance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.maintenance_type = 'service' THEN
    UPDATE vehicles
    SET
      last_service_date = NEW.maintenance_date,
      last_service_km_reading = COALESCE(NEW.odometer_reading, last_service_km_reading),
      next_service_km = CASE
        WHEN COALESCE(NEW.odometer_reading, last_service_km_reading) IS NOT NULL
         AND service_interval_km IS NOT NULL
         AND service_interval_km > 0
        THEN COALESCE(NEW.odometer_reading, last_service_km_reading) + service_interval_km
        ELSE next_service_km
      END
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_vehicle_service_on_maintenance ON vehicle_maintenance_records;
CREATE TRIGGER trg_update_vehicle_service_on_maintenance
  AFTER INSERT ON vehicle_maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_service_from_maintenance();