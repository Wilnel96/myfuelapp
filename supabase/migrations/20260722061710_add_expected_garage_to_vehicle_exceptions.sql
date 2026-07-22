/*
  # Add Expected Garage to Vehicle Exceptions

  ## Purpose
  When a GPS location mismatch is detected between a driver's actual location and the
  selected garage, the exception report should clearly show which garage was expected.

  ## Changes
  1. Add `expected_garage` column (text, nullable) to `vehicle_exceptions` table.
     - Stores the garage name that the driver was expected to be at.
     - Nullable because not all exception types involve a garage (e.g. odometer mismatch).

  ## Security
  - No new policies needed — existing RLS policies on `vehicle_exceptions` already cover
    the new column (it's part of the same table).
  - No data loss — this is a purely additive ALTER TABLE ADD COLUMN.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_exceptions' AND column_name = 'expected_garage'
  ) THEN
    ALTER TABLE vehicle_exceptions
    ADD COLUMN expected_garage text;
  END IF;
END $$;
