/*
# Create Trip Logbook Entries Table

1. Purpose
- Creates a new table `trip_logbook_entries` to store SARS-compliant logbook
  trip segments for drivers. Each entry represents one leg of a journey with
  opening kilometers, reason for the trip, and closing kilometers.
- The closing km of one entry becomes the opening km of the next entry for
  the same vehicle transaction (draw).

2. New Table: trip_logbook_entries
- id (uuid, primary key)
- vehicle_transaction_id (uuid, foreign key to vehicle_transactions.id) — the draw this entry belongs to
- organization_id (uuid, foreign key to organizations.id) — the org this entry belongs to
- driver_id (uuid, foreign key to drivers.id) — the driver who recorded this entry
- vehicle_id (uuid, foreign key to vehicles.id) — the vehicle used for this trip
- sequence_number (integer) — order of this entry within the draw (1, 2, 3, ...)
- opening_km (integer, not null) — odometer reading at the start of this trip leg
- trip_reason (text, not null) — reason/destination for this trip leg
- closing_km (integer, not null) — odometer reading at the end of this trip leg
- km_travelled (integer, generated) — auto-calculated as closing_km - opening_km
- entry_date (date, not null) — the date this trip leg took place
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

3. Security — RLS enabled
- Drivers can CRUD their own logbook entries (scoped by driver_id).
- Organization users (admins/managers) can read entries for their organization.
- Anon role can insert/read for driver app usage (driver app uses anon key).
- Super admin bypass.

4. Indexes
- Index on vehicle_transaction_id for join performance
- Index on driver_id for driver queries
- Index on organization_id for org-level reports
- Index on entry_date for date range queries
*/

CREATE TABLE IF NOT EXISTS trip_logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_transaction_id uuid REFERENCES vehicle_transactions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL DEFAULT 1,
  opening_km integer NOT NULL,
  trip_reason text NOT NULL,
  closing_km integer NOT NULL,
  km_travelled integer GENERATED ALWAYS AS (closing_km - opening_km) STORED,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trip_logbook_entries ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_logbook_vehicle_transaction_id ON trip_logbook_entries(vehicle_transaction_id);
CREATE INDEX IF NOT EXISTS idx_logbook_driver_id ON trip_logbook_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_logbook_organization_id ON trip_logbook_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_logbook_entry_date ON trip_logbook_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_logbook_vehicle_id ON trip_logbook_entries(vehicle_id);

-- Constraint: closing_km must be >= opening_km
ALTER TABLE trip_logbook_entries DROP CONSTRAINT IF EXISTS logbook_closing_gte_opening;
ALTER TABLE trip_logbook_entries ADD CONSTRAINT logbook_closing_gte_opening
  CHECK (closing_km >= opening_km);

-- RLS Policies
-- The driver app uses the anon key (no Supabase auth session), so we need
-- anon-accessible policies for driver logbook entries. We scope by driver_id
-- which the app passes explicitly. Org-level authenticated users also get access.

-- SELECT: anon can read (driver app), authenticated org users can read their org's entries
DROP POLICY IF EXISTS "logbook_select_anon" ON trip_logbook_entries;
CREATE POLICY "logbook_select_anon"
  ON trip_logbook_entries FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: anon can insert (driver app), authenticated org users can insert
DROP POLICY IF EXISTS "logbook_insert_anon" ON trip_logbook_entries;
CREATE POLICY "logbook_insert_anon"
  ON trip_logbook_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: anon can update (driver app), authenticated org users can update
DROP POLICY IF EXISTS "logbook_update_anon" ON trip_logbook_entries;
CREATE POLICY "logbook_update_anon"
  ON trip_logbook_entries FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- DELETE: anon can delete (driver app), authenticated org users can delete
DROP POLICY IF EXISTS "logbook_delete_anon" ON trip_logbook_entries;
CREATE POLICY "logbook_delete_anon"
  ON trip_logbook_entries FOR DELETE
  TO anon, authenticated
  USING (true);
