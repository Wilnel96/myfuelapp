/*
# Add Trip Type (Business/Private) to Logbook Entries

1. Purpose
- Adds a `trip_type` column to `trip_logbook_entries` so drivers can classify
  each logbook leg as "business" or "private" when entering closing kilometers.
- This is a SARS logbook requirement: business vs private travel must be
  distinguished for tax-deductible mileage claims.

2. Modified Tables
- `trip_logbook_entries`
  - New column: `trip_type` (text, nullable, CHECK constraint limits to
    'business' or 'private'). Defaults to 'business' since most fleet legs
    are business travel.
  - Existing entries will have NULL and are unaffected.

3. Security
- No RLS policy changes — existing policies already cover the new column.
*/

ALTER TABLE trip_logbook_entries
  ADD COLUMN IF NOT EXISTS trip_type text
  CHECK (trip_type IS NULL OR trip_type IN ('business', 'private'));

ALTER TABLE trip_logbook_entries
  ALTER COLUMN trip_type SET DEFAULT 'business';
