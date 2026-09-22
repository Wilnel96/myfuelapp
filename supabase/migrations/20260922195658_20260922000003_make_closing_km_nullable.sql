/*
# Make closing_km nullable for deferred logbook entries

1. Purpose
- Drivers record open km and reason at the START of a trip leg.
- Closing km is added later when the driver returns and knows the closing odometer.
- This makes closing_km nullable and adjusts km_travelled accordingly.

2. Changes
- Drop the CHECK constraint that required closing_km >= opening_km (closing can be null now)
- Drop the generated column km_travelled (can't be generated from nullable source)
- Re-add km_travelled as a regular nullable integer column
- Add a new CHECK constraint: closing_km IS NULL OR closing_km >= opening_km
*/

ALTER TABLE trip_logbook_entries DROP CONSTRAINT IF EXISTS logbook_closing_gte_opening;

ALTER TABLE trip_logbook_entries DROP COLUMN IF EXISTS km_travelled;

ALTER TABLE trip_logbook_entries ADD COLUMN IF NOT EXISTS km_travelled integer;

ALTER TABLE trip_logbook_entries ADD CONSTRAINT logbook_closing_gte_opening
  CHECK (closing_km IS NULL OR closing_km >= opening_km);
