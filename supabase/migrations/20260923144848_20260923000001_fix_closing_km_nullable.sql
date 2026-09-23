/*
# Fix: make closing_km nullable

1. Purpose
- The previous migration 20260922000003 did not take effect.
- closing_km is still NOT NULL, causing insert failures when drivers
  save a logbook entry without closing km (the new 2-step flow).

2. Changes
- ALTER COLUMN closing_km DROP NOT NULL
- Ensure km_travelled exists as nullable integer (already present)
- Ensure CHECK constraint allows null closing_km
*/

ALTER TABLE trip_logbook_entries ALTER COLUMN closing_km DROP NOT NULL;

ALTER TABLE trip_logbook_entries DROP CONSTRAINT IF EXISTS logbook_closing_gte_opening;
ALTER TABLE trip_logbook_entries ADD CONSTRAINT logbook_closing_gte_opening
  CHECK (closing_km IS NULL OR closing_km >= opening_km);
