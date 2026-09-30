/*
# Add "From" location field to SARS logbook entries

1. Purpose
- Adds a `from_location` text column to `trip_logbook_entries` so drivers can
  record WHERE each trip leg started from (e.g. "Cape Town depot", "Client warehouse").
- This sits between opening_km and trip_reason in the SARS logbook format.

2. Modified Tables
- `trip_logbook_entries`
  - New column: `from_location` (text, nullable — existing entries will have NULL)

3. Security
- No RLS policy changes — existing policies already cover the new column.

4. Important Notes
- Column is nullable so existing logbook entries are unaffected.
- The driver app and client portal report will be updated to include this field.
*/

ALTER TABLE trip_logbook_entries
  ADD COLUMN IF NOT EXISTS from_location text;
