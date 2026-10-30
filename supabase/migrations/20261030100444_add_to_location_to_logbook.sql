/*
# Add "Travel To" location field to SARS logbook entries

1. Purpose
- Adds a `to_location` text column to `trip_logbook_entries` so drivers can
  record WHERE each trip leg ended (the destination), alongside `from_location`.

2. Modified Tables
- `trip_logbook_entries`
  - New column: `to_location` (text, nullable, existing entries will have NULL)

3. Security
- No RLS policy changes. Existing policies already cover the new column.
*/

ALTER TABLE trip_logbook_entries
  ADD COLUMN IF NOT EXISTS to_location text;
