/*
# Scheduled maintenance and service reminders

1. Overview
- Clients can now log a maintenance job they plan to do on a future date (for example a service booked for next Tuesday).
- A daily job sends reminder emails for scheduled maintenance the day before it is due, and for km-based services when a vehicle gets within 1,000 km of its service due point.

2. New table: vehicle_scheduled_maintenance
- id, vehicle_id, organization_id (both required, cascade on delete)
- maintenance_type: service, other, license_renewal or insurance (same options as completed maintenance)
- description, maintenance_items, workshop: details of the planned job
- scheduled_date: the date the job is planned for
- status: scheduled, completed or cancelled (default scheduled)
- reminder_sent_at: set when the day-before reminder has been emailed, so it is sent only once
- created_at, created_by

3. Modified table: vehicles
- service_reminder_sent_for_km: the service due km (next_service_km) that a reminder was already emailed for, so each service due point triggers only one km reminder.

4. Daily reminder job
- Uses pg_cron to call the send-maintenance-reminders function every day at 04:00 UTC (06:00 South Africa time).
- The function does all checks and sending; this migration only schedules it.

5. Security
- RLS enabled on vehicle_scheduled_maintenance with four separate policies (select, insert, update, delete) using the same organization scoping as vehicle_maintenance_records.
- Grants: authenticated users can read and manage rows; service_role can update reminder fields for the email job.

6. Notes
- The job URL points at this project's Supabase address. If the project is ever rebuilt under a new address, update the URL here.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_reminder_sent_for_km integer;

CREATE TABLE IF NOT EXISTS vehicle_scheduled_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL DEFAULT 'service' CHECK (maintenance_type IN ('service', 'other', 'license_renewal', 'insurance')),
  description text NOT NULL,
  maintenance_items text[],
  workshop text,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_scheduled_maintenance_vehicle_id ON vehicle_scheduled_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_scheduled_maintenance_org_id ON vehicle_scheduled_maintenance(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_scheduled_maintenance_due ON vehicle_scheduled_maintenance(scheduled_date) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_vehicle_scheduled_maintenance_created_by ON vehicle_scheduled_maintenance(created_by);

ALTER TABLE vehicle_scheduled_maintenance ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_scheduled_maintenance TO authenticated;
GRANT SELECT, UPDATE ON vehicle_scheduled_maintenance TO service_role;

DROP POLICY IF EXISTS "select_own_scheduled_maintenance" ON vehicle_scheduled_maintenance;
CREATE POLICY "select_own_scheduled_maintenance"
  ON vehicle_scheduled_maintenance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_scheduled_maintenance.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "insert_own_scheduled_maintenance" ON vehicle_scheduled_maintenance;
CREATE POLICY "insert_own_scheduled_maintenance"
  ON vehicle_scheduled_maintenance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_scheduled_maintenance.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "update_own_scheduled_maintenance" ON vehicle_scheduled_maintenance;
CREATE POLICY "update_own_scheduled_maintenance"
  ON vehicle_scheduled_maintenance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_scheduled_maintenance.organization_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_scheduled_maintenance.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "delete_own_scheduled_maintenance" ON vehicle_scheduled_maintenance;
CREATE POLICY "delete_own_scheduled_maintenance"
  ON vehicle_scheduled_maintenance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'super_admin'
        OR profiles.organization_id = vehicle_scheduled_maintenance.organization_id
      )
    )
  );

DO $$
BEGIN
  PERFORM cron.unschedule('send-maintenance-reminders');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'send-maintenance-reminders',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhklqlqpowrwjplrkfzz.supabase.co/functions/v1/send-maintenance-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
